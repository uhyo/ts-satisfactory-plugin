import {
  Expression,
  InlayHint,
  Node,
  SourceFile,
  TextSpan,
} from "typescript/lib/tsserverlibrary.js";

type InlayTarget = {
  target: Node;
  expression: Expression;
};

export function getAdditionalInlays(
  ts: typeof import("typescript/lib/tsserverlibrary.js"),
  program: SourceFile,
  span: TextSpan
) {
  const checkedDecls: InlayTarget[] = [];
  listAllTargetNodes(ts, program, span, checkedDecls);
  const result: InlayHint[] = checkedDecls.flatMap((decl) => {
    const sat = getSatisfiesConstraint(ts, decl.expression);
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

function listAllTargetNodes(
  ts: typeof import("typescript/lib/tsserverlibrary.js"),
  node: Node,
  span: TextSpan,
  result: InlayTarget[]
) {
  const spanEnd = span.start + span.length;
  if (ts.isVariableDeclaration(node) && node.initializer) {
    const parent = node.parent;
    if (!ts.isCatchClause(parent)) {
      const target = parent.declarations[0] === node ? parent : node;
      result.push({
        target,
        expression: node.initializer,
      });
    }
  }
  if (ts.isPropertyDeclaration(node) && node.initializer) {
    result.push({
      target: node,
      expression: node.initializer,
    });
  }
  if (ts.isPropertyAssignment(node)) {
    result.push({
      target: node,
      expression: node.initializer,
    });
  }
  ts.forEachChild(node, (child) => {
    if (child.end < span.start) {
      return;
    }
    if (spanEnd <= child.pos) {
      return true;
    }
    listAllTargetNodes(ts, child, span, result);
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
  decl: InlayTarget
) {
  const node = decl.target;
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
  while (result > 0 && ts.isWhiteSpaceLike(fullTrivia.charCodeAt(result - 1))) {
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
