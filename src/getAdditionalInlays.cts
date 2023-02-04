import {
  Expression,
  InlayHint,
  Node,
  SourceFile,
  TextSpan,
  VariableDeclaration,
  VariableDeclarationList,
} from "typescript/lib/tsserverlibrary.js";

export function getAdditionalInlays(
  ts: typeof import("typescript/lib/tsserverlibrary.js"),
  program: SourceFile,
  span: TextSpan
) {
  const checkedDecls: VariableDeclaration[] = [];
  listAllTargetSentences(ts, program, span, checkedDecls);
  const result: InlayHint[] = checkedDecls.flatMap((decl) => {
    if (!decl.initializer) {
      return [];
    }
    const sat = getSatisfiesConstraint(ts, decl.initializer);
    if (!sat) {
      return [];
    }
    const res = calcInlayPosition(ts, decl);
    if (res === undefined) {
      return [];
    }
    const { position, leadingSpaces } = res;
    return [
      {
        kind: ts.InlayHintKind.Type,
        position,
        text: " ".repeat(leadingSpaces) + "satisfies " + sat.getText(),
        whitespaceAfter: true,
      },
    ];
  });
  return result;
}

function listAllTargetSentences(
  ts: typeof import("typescript/lib/tsserverlibrary.js"),
  node: Node,
  span: TextSpan,
  result: VariableDeclaration[]
) {
  const spanEnd = span.start + span.length;
  if (ts.isVariableDeclaration(node)) {
    result.push(node);
  }
  ts.forEachChild(node, (child) => {
    if (child.end < span.start) {
      return;
    }
    if (spanEnd <= child.pos) {
      return true;
    }
    listAllTargetSentences(ts, child, span, result);
  });
}

function getSatisfiesConstraint(
  ts: typeof import("typescript/lib/tsserverlibrary.js"),
  expression: Expression
) {
  if (ts.isSatisfiesExpression(expression)) {
    return expression.type;
  }
  return undefined;
}

function calcInlayPosition(
  ts: typeof import("typescript/lib/tsserverlibrary.js"),
  decl: VariableDeclaration
) {
  const parent = decl.parent;
  if (ts.isCatchClause(parent)) {
    return undefined;
  }
  if (parent.declarations[0] === decl) {
    return adjustPos(parent);
  }
  return adjustPos(decl);

  function adjustPos(node: VariableDeclaration | VariableDeclarationList) {
    const triv = node.getLeadingTriviaWidth();
    if (triv === 0) {
      return {
        position: node.pos,
        leadingSpaces: 0,
      };
    }
    const np = ts.getLineAndCharacterOfPosition(
      node.getSourceFile(),
      node.pos + triv
    );
    const fullTrivia = node.getFullText(node.getSourceFile()).slice(0, triv);
    let result = triv;
    let leadingSpaces = 0;
    while (
      result > 0 &&
      ts.isWhiteSpaceLike(fullTrivia.charCodeAt(result - 1))
    ) {
      result--;
      if (ts.isLineBreak(fullTrivia.charCodeAt(result))) {
        const lp = ts.getLineAndCharacterOfPosition(
          node.getSourceFile(),
          node.pos + result
        );
        if (np.character < lp.character) {
          result++;
        } else {
          leadingSpaces = np.character - lp.character;
        }
        break;
      }
    }
    return {
      position: node.pos + result,
      leadingSpaces,
    };
  }
}
