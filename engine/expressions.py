"""
Safe AST-based expression evaluator.
Strictly domain-agnostic.
Never uses eval() or exec().
"""

import ast
from decimal import Decimal, InvalidOperation
from typing import Any, Dict


class ExpressionSecurityError(Exception):
    """Raised when an expression attempts unsafe operations or syntax."""
    pass


class SafeExpressionEvaluator:
    ALLOWED_FUNCTIONS = {
        "min": min,
        "max": max,
        "abs": abs,
        "round": round,
    }

    def __init__(self, context: Dict[str, Any]):
        # Convert numeric values in context to Decimal where possible
        self.context: Dict[str, Any] = {}
        for k, v in context.items():
            if not isinstance(v, bool) and isinstance(v, (int, float)):
                self.context[k] = Decimal(str(v))
            else:
                self.context[k] = v

    def evaluate(self, expr_str: str) -> Any:
        try:
            tree = ast.parse(expr_str.strip(), mode="eval")
        except SyntaxError as e:
            raise ExpressionSecurityError(f"Syntax error in expression: {e}")

        return self._eval_node(tree.body)

    def _eval_node(self, node: ast.AST) -> Any:
        if isinstance(node, ast.Constant):
            val = node.value
            if isinstance(val, (int, float)):
                return Decimal(str(val))
            return val


        if isinstance(node, ast.Name):
            if node.id in self.context:
                val = self.context[node.id]
                if isinstance(val, (int, float)):
                    return Decimal(str(val))
                return val
            elif node.id in self.ALLOWED_FUNCTIONS:
                return self.ALLOWED_FUNCTIONS[node.id]
            elif node.id == "True":
                return True
            elif node.id == "False":
                return False
            elif node.id == "None":
                return None
            else:
                raise ExpressionSecurityError(f"Undefined variable in expression: {node.id}")

        if isinstance(node, ast.UnaryOp):
            operand = self._eval_node(node.operand)
            if isinstance(node.op, ast.UAdd):
                return +operand
            elif isinstance(node.op, ast.USub):
                return -operand
            elif isinstance(node.op, ast.Not):
                return not operand
            else:
                raise ExpressionSecurityError(f"Unsupported unary operator: {type(node.op).__name__}")

        if isinstance(node, ast.BinOp):
            left = self._eval_node(node.left)
            right = self._eval_node(node.right)
            # Ensure Decimal operations
            if isinstance(left, (int, float)):
                left = Decimal(str(left))
            if isinstance(right, (int, float)):
                right = Decimal(str(right))

            if isinstance(node.op, ast.Add):
                return left + right
            elif isinstance(node.op, ast.Sub):
                return left - right
            elif isinstance(node.op, ast.Mult):
                return left * right
            elif isinstance(node.op, ast.Div):
                if right == Decimal("0"):
                    raise ZeroDivisionError("Division by zero in pricing formula")
                return left / right
            elif isinstance(node.op, ast.FloorDiv):
                return left // right
            elif isinstance(node.op, ast.Mod):
                return left % right
            elif isinstance(node.op, ast.Pow):
                return left ** right
            else:
                raise ExpressionSecurityError(f"Unsupported binary operator: {type(node.op).__name__}")

        if isinstance(node, ast.Compare):
            left = self._eval_node(node.left)
            for op, comparator in zip(node.ops, node.comparators):
                right = self._eval_node(comparator)
                if isinstance(left, (int, float)) and isinstance(right, Decimal):
                    left = Decimal(str(left))
                elif isinstance(right, (int, float)) and isinstance(left, Decimal):
                    right = Decimal(str(right))

                matched = False
                if isinstance(op, ast.Eq):
                    matched = (left == right)
                elif isinstance(op, ast.NotEq):
                    matched = (left != right)
                elif isinstance(op, ast.Lt):
                    matched = (left < right)
                elif isinstance(op, ast.LtE):
                    matched = (left <= right)
                elif isinstance(op, ast.Gt):
                    matched = (left > right)
                elif isinstance(op, ast.GtE):
                    matched = (left >= right)
                elif isinstance(op, ast.In):
                    matched = (left in right)
                elif isinstance(op, ast.NotIn):
                    matched = (left not in right)
                else:
                    raise ExpressionSecurityError(f"Unsupported comparison operator: {type(op).__name__}")

                if not matched:
                    return False
                left = right
            return True

        if isinstance(node, ast.BoolOp):
            if isinstance(node.op, ast.And):
                for val_node in node.values:
                    if not self._eval_node(val_node):
                        return False
                return True
            elif isinstance(node.op, ast.Or):
                for val_node in node.values:
                    if self._eval_node(val_node):
                        return True
                return False

        if isinstance(node, ast.Call):
            func = self._eval_node(node.func)
            if func not in self.ALLOWED_FUNCTIONS.values():
                raise ExpressionSecurityError("Only whitelisted math functions are permitted")
            args = [self._eval_node(arg) for arg in node.args]
            return func(*args)

        raise ExpressionSecurityError(f"Disallowed expression node: {type(node).__name__}")
