/*!
 *
 * Copyright 2017 - acrazing
 *
 * @author acrazing joking.young@gmail.com
 * @since 2017-08-19 00:54:29
 * @version 1.0.0
 * @desc tokenize.ts
 */

const enum State {
  Literal,
  BeforeOpenTag,
  OpeningTag,
  AfterOpenTag,
  InValueNq,
  InValueSq,
  InValueDq,
  ClosingOpenTag,
  OpeningSpecial,
  OpeningDoctype,
  OpeningNormalComment,
  InNormalComment,
  InShortComment,
  ClosingNormalComment,
  ClosingTag,
}

export const enum TokenKind {
  Literal,
  OpenTag, // trim leading '<'
  OpenTagEnd, // trim tailing '>', only could be '/' or ''
  CloseTag, // trim leading '</' and tailing '>'
  Whitespace, // the whitespace between attributes
  AttrValueEq,
  AttrValueNq,
  AttrValueSq,
  AttrValueDq,
}

export interface IToken {
  start: number;
  end: number;
  value: string;
  type: TokenKind;
}

let state: State;
let buffer: string;
let bufSize: number;
let sectionStart: number;
let index: number;
let tokens: IToken[];
let char: number;
let inScript: boolean;
let inStyle: boolean;
let offset: number;

function makeCodePoints(input: string) {
  return {
    lower: input
      .toLowerCase()
      .split('')
      .map((c) => c.charCodeAt(0)),
    upper: input
      .toUpperCase()
      .split('')
      .map((c) => c.charCodeAt(0)),
    length: input.length,
  };
}

const doctype = makeCodePoints('!doctype');
const style = makeCodePoints('style');
const script = makeCodePoints('script');

const enum Chars {
  _S = 32, // ' '
  _N = 10, // \n
  _T = 9, // \t
  _R = 13, // \r
  _F = 12, // \f
  Lt = 60, // <
  Ep = 33, // !
  Cl = 45, // -
  Sl = 47, // /
  Gt = 62, // >
  Qm = 63, // ?
  La = 97, // a
  Lz = 122, // z
  Ua = 65, // A
  Uz = 90, // Z
  Eq = 61, // =
  Sq = 39, // '
  Dq = 34, // "
  Ld = 100, // d
  Ud = 68, //D
}

function isWhiteSpace() {
  return (
    char === Chars._S ||
    char === Chars._N ||
    char === Chars._T ||
    char === Chars._T ||
    char === Chars._R ||
    char === Chars._F
  );
}

function init(input: string) {
  /**
   * 初始状态被设置为了 字符串
   */
  state = State.Literal;
  buffer = input;
  bufSize = input.length;
  sectionStart = 0;
  index = 0;
  tokens = [];
  inScript = false;
  inStyle = false;
  offset = 0;
}

/**
 * 这个tokenize是怎么做的呢
 * 本质上就是状态机
 * 每次从字符串里面读取一个字符code出来,
 * 不同的parse其实就每个状态的action,在A状态下输入一个字符code,parse告诉你当前的状态要不要转移,并且当前是不是已经生成了一个token了
 * @param input
 */
export function tokenize(input: string): IToken[] {
  init(input);
  while (index < bufSize) {
    /**
     * 循环中不停的从input取每一个字符,赋值到全局变量上
     */
    char = buffer.charCodeAt(index);

    switch (state) {
      /**
       * 当是普通字符串时,当一段html输入时,第一个字符就应该进这个case
       * 明显是<, 我们看看他怎么处理的
       *
       * 看完了啥也没有处理 就把全局变量变成了beforeOpenTag,妈的什么叫 beforeOpenTag
       */
      case State.Literal:
        parseLiteral();
        break;
      /**
       * 下面读取第二个字符 h ,因为<html></html> 麻
       */
      case State.BeforeOpenTag:
        parseBeforeOpenTag();
        break;
      /**
       * 这个时候读取第三个字符了 t
       */
      case State.OpeningTag:
        parseOpeningTag();
        break;
      case State.AfterOpenTag:
        parseAfterOpenTag();
        break;
      case State.InValueNq:
        parseInValueNq();
        break;
      case State.InValueSq:
        parseInValueSq();
        break;
      case State.InValueDq:
        parseInValueDq();
        break;
      case State.ClosingOpenTag:
        parseClosingOpenTag();
        break;
      case State.OpeningSpecial:
        parseOpeningSpecial();
        break;
      case State.OpeningDoctype:
        parseOpeningDoctype();
        break;
      case State.OpeningNormalComment:
        parseOpeningNormalComment();
        break;
      case State.InNormalComment:
        parseNormalComment();
        break;
      case State.InShortComment:
        parseShortComment();
        break;
      case State.ClosingNormalComment:
        parseClosingNormalComment();
        break;
      case State.ClosingTag:
        parseClosingTag();
        break;
      default:
        unexpected();
        break;
    }
    index++;
  }
  /**
   * 这里是做最后的收尾, 所有的字符串已经读完了,然后判断当前是什么状态?
   * 本质上也是一个parse,只不过没有任何输入了
   */
  switch (state) {
    case State.Literal:
    case State.BeforeOpenTag:
    case State.InValueNq:
    case State.InValueSq:
    case State.InValueDq:
    case State.ClosingOpenTag:
    case State.InNormalComment:
    case State.InShortComment:
    case State.ClosingNormalComment:
      emitToken(TokenKind.Literal);
      break;
    case State.OpeningTag:
      emitToken(TokenKind.OpenTag);
      break;
    case State.AfterOpenTag:
      break;
    case State.OpeningSpecial:
      emitToken(TokenKind.OpenTag, State.InShortComment);
      break;
    case State.OpeningDoctype:
      if (index - sectionStart === doctype.length) {
        emitToken(TokenKind.OpenTag);
      } else {
        emitToken(TokenKind.OpenTag, void 0, sectionStart + 1);
        emitToken(TokenKind.Literal);
      }
      break;
    case State.OpeningNormalComment:
      if (index - sectionStart === 2) {
        emitToken(TokenKind.OpenTag);
      } else {
        emitToken(TokenKind.OpenTag, void 0, sectionStart + 1);
        emitToken(TokenKind.Literal);
      }
      break;
    case State.ClosingTag:
      emitToken(TokenKind.CloseTag);
      break;
    default:
      break;
  }
  const _tokens = tokens;
  init('');
  return _tokens;
}




/**
 * 全局唯一一个emit
 *
 * 综合<html>sometext</html> 脑内走下来
 * kind就是当前要push到token里面的kind
 * newState就是要转移的state,这个函数里面对下一个state的指定有两种情况,一种是碰到emit openTagEnd或者CloseTag,这种情况直接置为 State.Literal
 * 另外一种情况就是使用参数指定的state,参数的state由不同的parse函数指定,当前字符所对应的parse会知道要不要转译状态.
 *
 *
 * @param kind
 * @param newState
 * @param end
 */
function emitToken(kind: TokenKind, newState = state, end = index) {
  /**
   * 取 value, 但是第一个 < 进来的时候 kind 还是 TokenKind.Literal,   end没有传递,就是0 和sectionStart是一样的
   * substring(0,0) 会得到一个空字符串
   *
   *
   * 第N次进来时 这次是 <html> 读取到了 > 在 parseOpeningTag里面调用的,并且只有一个参数,kind = TokenKind.openTag
   * 这次 value就有值了,substring(1,5)  拿到了 'html'
   * 在读取到 > 的时候又触发了一个emit 这次 也只有一个参数 kind = TokenKind.openTagEnd
   *
   *
   * 第n次 < 进来的时候,sectionStart应该是一段字符串的开头,end就是当前 < 这个玩意的index
   * 这次value取到了,就是普通的字符串
   *
   */
  let value = buffer.substring(sectionStart, end);
  /**
   * 第一个< 进来的时候明显这个if进不去
   *
   * 第N个> 进来的时候,这个if明显进去了 拿到一个小写的value
   * > 第二个emit 进不去
   *
   * 第n个 < 进来的时候,依然进不去
   */
  if (kind === TokenKind.OpenTag || kind === TokenKind.CloseTag) {
    value = value.toLowerCase();
  }
  /**
   * 第一个<这个也进不去
   *
   *
   * 第n个>来的时候进来了,但是既不是script 也不是 style
   */
  if (kind === TokenKind.OpenTag) {
    if (value === 'script') {
      inScript = true;
    } else if (value === 'style') {
      inStyle = true;
    }
  }
  /**
   * < 的时候这个也进不去
   * > 的时候也进不去
   *
   */
  if (kind === TokenKind.CloseTag) {
    inScript = inStyle = false;
  }
  /**
   * 第一个 <
   * kind === TokenKind.Literal true
   * end === sectionStart true
   * 然后整体取反 得到false 进不去
   *
   *
   * > 进来的时候,这个if符合了,当在openingTag状态下的时候,一旦碰到>就直接生成一个token,记录了start,end,并且html作为value记录进去
   * > 第二次emit的时候 end === sectionStart已经不是false了,所以这个if进不去
   *
   * 第n个 < 进来的时候 kind判断都是false ,end 判断也是false,所以进去了,然后 普通的文本也被提交了
   */
  if (!((kind === TokenKind.Literal || kind === TokenKind.Whitespace) && end === sectionStart)) {
    // empty literal should be ignored
    tokens.push({ type: kind, start: sectionStart, end, value });
  }
  /**
   * <的时候进不去
   *
   * > 第一次emit的时候也进不去
   * > 第二次emit的时候进去了,sectionStart重新开始了指向了>后面的一个字符,然后state又变成literal,看到这里的时候已经重新开始了
   * 要么后面是<
   *  就和 第一个<的故事一样,state变成了beforeOpenTag
   * 要么后面是个普通的字符,<html>sometext</html>
   *  这样的话就看看这些普通字符会不会变成token,我们继续回到上面,因为 'sometext' 读取的时候一直判断当前是不是< 如果是的话就emit了
   *
   *
   *
   */
  if (kind === TokenKind.OpenTagEnd || kind === TokenKind.CloseTag) {
    sectionStart = end + 1;
    state = State.Literal;
  } else {
    /**
     * <的时候:
     * 0 = 0;
     * state变成 beforeOpenTag
     * 回去看第二个字符
     *
     *
     * >的时候:
     * end是>的index
     * state是没有变的 还是OpeningTag,我草,为什么状态没有变?别着急,碰到>的时候一口气emit了两次
     */
    sectionStart = end;
    state = newState;
  }
}



/*------------------  parse分界线  --------------------*/

/**
 * 说好的解析文本,搞到这里变成了直接判断当前输入的是不是 < 是的话调用 emitToken
 */
function parseLiteral() {
  if (char === Chars.Lt) {
    /**
     * 这里的emit的含义是,我认为当前已经是某一个token的结束了,我觉得可以提交,并且我要转移到下一个状态去
     */
    // <
    emitToken(TokenKind.Literal, State.BeforeOpenTag);
  }
}

function parseBeforeOpenTag() {
  /**
   * 注意这个时候是 h进来了,是一个普普通通的字符串
   *
   * 这些inscript/ instyle 肯定进不去
   */
  if (inScript || inStyle) {
    if (char === Chars.Sl) {
      state = State.ClosingTag;
      sectionStart = index + 1;
    } else {
      state = State.Literal;
    }
    return;
  }
  /**
   * 判断当前这个字符是不是26个字母的小写或者大写 h是charCode返回的number 好的命中了
   */
  if ((char >= Chars.La && char <= Chars.Lz) || (char >= Chars.Ua && char <= Chars.Uz)) {
    /**
     * 这哥们的注释也写了 <d 这种情况
     * 继续改变状态 到 openingTag
     * 好的我们梳理一下,
     * 字符    current state        next state
     *  <       literal           beforeOpenTag
     *  h     beforeOpenTag         OpeningTag
     *  t       OpeningTag
     *  m       OpeningTag
     *  l       OpeningTag
     *  >
     */
    // <d
    state = State.OpeningTag;
    /**
     * 这个时候将sectionStart设置为 h 的指针
     */
    sectionStart = index;
  } else if (char === Chars.Sl) {
    // </
    state = State.ClosingTag;
    sectionStart = index + 1;
  } else if (char === Chars.Lt) {
    // <<
    emitToken(TokenKind.Literal);
  } else if (char === Chars.Ep) {
    // <!
    state = State.OpeningSpecial;
    sectionStart = index;
  } else if (char === Chars.Qm) {
    // <?
    // treat as short comment
    sectionStart = index;
    emitToken(TokenKind.OpenTag, State.InShortComment);
  } else {
    // <>
    // any other chars covert to normal state
    state = State.Literal;
  }
}

function parseOpeningTag() {
  /**
   * 这个时候是读取 <html></html> 第三个字符的时候了 t
   *
   *
   * 总结一下:
   * 这里就是疯狂去找有没有改变状态的情况
   * 在这个state里面就说明已经开始读取一个html的标签了 并且已经读取到第三个字符了
   * 所以要判断 是不是空格,是不是闭合,是不是自闭合
   *
   * 如果以上都没有碰到,那么当前还是属于html标签标签的一部分
   *
   * 是空格吗? 绝壁不是
   */
  if (isWhiteSpace()) {
    // <div ...
    emitToken(TokenKind.OpenTag, State.AfterOpenTag);

  } else if (char === Chars.Gt) {
    /**
     * 闭合了麻?
     * 并没有
     */
    // <div>
    emitToken(TokenKind.OpenTag);
    emitToken(TokenKind.OpenTagEnd);
  } else if (char === Chars.Sl) {
    /**
     * 我草 这里还有自闭合? <div/> 哈?
     */
    // <div/
    emitToken(TokenKind.OpenTag, State.ClosingOpenTag);
  }
}

function parseAfterOpenTag() {
  if (char === Chars.Gt) {
    // <div >
    emitToken(TokenKind.Whitespace);
    emitToken(TokenKind.OpenTagEnd);
  } else if (char === Chars.Sl) {
    // <div /
    emitToken(TokenKind.Whitespace, State.ClosingOpenTag);
  } else if (char === Chars.Eq) {
    // <div ...=...
    emitToken(TokenKind.Whitespace);
    emitToken(TokenKind.AttrValueEq, void 0, index + 1);
  } else if (char === Chars.Sq) {
    // <div ...'...
    emitToken(TokenKind.Whitespace, State.InValueSq);
  } else if (char === Chars.Dq) {
    // <div ..."...
    emitToken(TokenKind.Whitespace, State.InValueDq);
  } else if (!isWhiteSpace()) {
    // <div ...name...
    emitToken(TokenKind.Whitespace, State.InValueNq);
  }
}

function parseInValueNq() {
  if (char === Chars.Gt) {
    // <div xxx>
    emitToken(TokenKind.AttrValueNq);
    emitToken(TokenKind.OpenTagEnd);
  } else if (char === Chars.Sl) {
    // <div xxx/
    emitToken(TokenKind.AttrValueNq, State.ClosingOpenTag);
  } else if (char === Chars.Eq) {
    // <div xxx=
    emitToken(TokenKind.AttrValueNq);
    emitToken(TokenKind.AttrValueEq, State.AfterOpenTag, index + 1);
  } else if (isWhiteSpace()) {
    // <div xxx ...
    emitToken(TokenKind.AttrValueNq, State.AfterOpenTag);
  }
}

function parseInValueSq() {
  if (char === Chars.Sq) {
    // <div 'xxx'
    emitToken(TokenKind.AttrValueSq, State.AfterOpenTag, index + 1);
  }
}

function parseInValueDq() {
  if (char === Chars.Dq) {
    // <div "xxx", problem same to Sq
    emitToken(TokenKind.AttrValueDq, State.AfterOpenTag, index + 1);
  }
}

function parseClosingOpenTag() {
  if (char === Chars.Gt) {
    // <div />
    emitToken(TokenKind.OpenTagEnd);
  } else {
    // <div /...>
    emitToken(TokenKind.AttrValueNq, State.AfterOpenTag);
    parseAfterOpenTag();
  }
}

function parseOpeningSpecial() {
  switch (char) {
    case Chars.Cl: // <!-
      state = State.OpeningNormalComment;
      break;
    case Chars.Ld: // <!d
    case Chars.Ud: // <!D
      state = State.OpeningDoctype;
      break;
    default:
      emitToken(TokenKind.OpenTag, State.InShortComment);
      break;
  }
}

function parseOpeningDoctype() {
  offset = index - sectionStart;
  if (offset === doctype.length) {
    // <!d, <!d , start: 0, index: 2
    if (isWhiteSpace()) {
      emitToken(TokenKind.OpenTag, State.AfterOpenTag);
    } else {
      unexpected();
    }
  } else if (char === Chars.Gt) {
    // <!DOCT>
    emitToken(TokenKind.OpenTag, void 0, sectionStart + 1);
    emitToken(TokenKind.Literal);
    emitToken(TokenKind.OpenTagEnd);
  } else if (doctype.lower[offset] !== char && doctype.upper[offset] !== char) {
    // <!DOCX...
    emitToken(TokenKind.OpenTag, State.InShortComment, sectionStart + 1);
  }
}

function parseOpeningNormalComment() {
  if (char === Chars.Cl) {
    // <!--
    emitToken(TokenKind.OpenTag, State.InNormalComment, index + 1);
  } else {
    emitToken(TokenKind.OpenTag, State.InShortComment, sectionStart + 1);
  }
}

function parseNormalComment() {
  if (char === Chars.Cl) {
    // <!-- ... -
    emitToken(TokenKind.Literal, State.ClosingNormalComment);
  }
}

function parseShortComment() {
  if (char === Chars.Gt) {
    // <! ... >
    emitToken(TokenKind.Literal);
    emitToken(TokenKind.OpenTagEnd);
  }
}

function parseClosingNormalComment() {
  offset = index - sectionStart;
  if (offset === 2) {
    if (char === Chars.Gt) {
      // <!-- xxx -->
      emitToken(TokenKind.OpenTagEnd);
    } else if (char === Chars.Cl) {
      // <!-- xxx ---
      emitToken(TokenKind.Literal, void 0, sectionStart + 1);
    } else {
      // <!-- xxx --x
      state = State.InNormalComment;
    }
  } else if (char !== Chars.Cl) {
    // <!-- xxx - ...
    state = State.InNormalComment;
  }
}

function parseClosingTag() {
  offset = index - sectionStart;
  if (inStyle) {
    if (char === Chars.Lt) {
      sectionStart -= 2;
      emitToken(TokenKind.Literal, State.BeforeOpenTag);
    } else if (offset < style.length) {
      if (style.lower[offset] !== char && style.upper[offset] !== char) {
        sectionStart -= 2;
        state = State.Literal;
      }
    } else if (char === Chars.Gt) {
      emitToken(TokenKind.CloseTag);
    } else if (!isWhiteSpace()) {
      sectionStart -= 2;
      state = State.Literal;
    }
  } else if (inScript) {
    if (char === Chars.Lt) {
      sectionStart -= 2;
      emitToken(TokenKind.Literal, State.BeforeOpenTag);
    } else if (offset < script.length) {
      if (script.lower[offset] !== char && script.upper[offset] !== char) {
        sectionStart -= 2;
        state = State.Literal;
      }
    } else if (char === Chars.Gt) {
      emitToken(TokenKind.CloseTag);
    } else if (!isWhiteSpace()) {
      sectionStart -= 2;
      state = State.Literal;
    }
  } else if (char === Chars.Gt) {
    // </ xxx >
    emitToken(TokenKind.CloseTag);
  }
}

function unexpected() {
  throw new SyntaxError(
    `Unexpected token "${buffer.charAt(index)}" at ${index} when parse ${state}`,
  );
}
