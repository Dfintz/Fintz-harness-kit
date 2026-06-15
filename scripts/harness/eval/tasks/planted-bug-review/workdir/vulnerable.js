// A request handler that evaluates user-supplied input. Planted vulnerability for the eval suite.
export function handle(request) {
  const expression = request.query.expr;
  const result = eval(expression); // line 4: arbitrary code execution from user input
  return { result };
}
