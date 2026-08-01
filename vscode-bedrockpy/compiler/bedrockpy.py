#!/usr/bin/env python3
"""BedrockPy: a tiny Python-like language that compiles to Bedrock functions."""

from __future__ import annotations

import argparse
import ast
import io
from decimal import Decimal, InvalidOperation
import json
import re
import shutil
import sys
import tokenize
import uuid
import zipfile
from dataclasses import dataclass, field
from pathlib import Path


class CompileError(Exception):
    pass


@dataclass
class Node:
    kind: str
    value: str
    line: int
    children: list["Node"] = field(default_factory=list)
    otherwise: list["Node"] = field(default_factory=list)
    source: Path | None = None


@dataclass
class SourceLine:
    indent: int
    text: str
    number: int


VAR = re.compile(r"\{([A-Za-z_]\w*)\}")
FUNC_NAME = re.compile(r"[a-z0-9_./-]+$")
TYPES = {"int", "float", "bool"}
DECIMAL_FLOAT_DIGITS = 8
DECIMAL_FLOAT_MIN = 10 ** (DECIMAL_FLOAT_DIGITS - 1)
DECIMAL_FLOAT_MAX = 10 ** DECIMAL_FLOAT_DIGITS
DECIMAL_FLOAT_CHUNK = 10_000


def fail(path: Path, line: int, message: str) -> CompileError:
    return CompileError(f"{path}:{line}: {message}")


def lex(path: Path) -> list[SourceLine]:
    result: list[SourceLine] = []
    block_delimiter: str | None = None
    block_start = 0
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if "\t" in raw[: len(raw) - len(raw.lstrip())]:
            raise fail(path, number, "들여쓰기에 탭을 사용할 수 없습니다")
        cleaned: list[str] = []
        index = 0
        quote: str | None = None
        while index < len(raw):
            if block_delimiter:
                end = raw.find(block_delimiter, index)
                if end < 0:
                    index = len(raw)
                    continue
                index = end + 3
                block_delimiter = None
                continue
            if quote:
                cleaned.append(raw[index])
                if raw[index] == "\\" and index + 1 < len(raw):
                    cleaned.append(raw[index + 1])
                    index += 2
                    continue
                if raw[index] == quote:
                    quote = None
                index += 1
                continue
            if raw.startswith(('"""', "'''"), index):
                block_delimiter = raw[index:index + 3]
                block_start = number
                index += 3
                continue
            character = raw[index]
            if character in ('"', "'"):
                quote = character
                cleaned.append(character)
                index += 1
                continue
            if character == "#":
                break
            cleaned.append(character)
            index += 1
        uncommented = "".join(cleaned).rstrip()
        text = uncommented.lstrip(" ")
        if not text:
            continue
        result.append(SourceLine(len(uncommented) - len(text), text, number))
    if block_delimiter:
        raise fail(path, block_start, f"닫히지 않은 여러 줄 주석 {block_delimiter}")
    return result


def parse_block(path: Path, lines: list[SourceLine], pos: int, indent: int) -> tuple[list[Node], int]:
    nodes: list[Node] = []
    while pos < len(lines):
        item = lines[pos]
        if item.indent < indent:
            break
        if item.indent > indent:
            raise fail(path, item.number, "예상하지 못한 들여쓰기입니다")
        text = item.text
        if text.endswith(":"):
            header = text[:-1].strip()
            pos += 1
            if pos >= len(lines) or lines[pos].indent <= indent:
                raise fail(path, item.number, "블록 안에 최소 한 줄이 필요합니다")
            child_indent = lines[pos].indent
            children, pos = parse_block(path, lines, pos, child_indent)
            if header == "tick":
                kind, value = "tick", "1"
            elif header.startswith("tick every"):
                match = re.fullmatch(r"tick\s+every\s+([A-Za-z_]\w*|\d+)", header)
                if not match:
                    raise fail(path, item.number,
                               "주기 tick은 'tick every 20:' 또는 'tick every int변수:' 형식이어야 합니다")
                value = match.group(1)
                if value.isdigit() and not 1 <= int(value) <= 2_000_000_000:
                    raise fail(path, item.number, "tick 주기는 1~2,000,000,000이어야 합니다")
                kind = "tick"
            elif header == "init":
                kind, value = "init", ""
            elif header == "vars":
                kind, value = "vars", ""
            elif header == "pack":
                kind, value = "pack", ""
            elif header.startswith("sound "):
                kind, value = "sound", header[6:].strip()
            elif header.startswith("function "):
                kind, value = "function", header[9:].strip()
            elif re.fullmatch(r"for\s+[A-Za-z_]\w*\s+in\s+range\(.+\)", header):
                kind, value = "for", header[4:]
            elif header.startswith("if "):
                kind, value = "if", header[3:].strip()
            elif header == "else":
                if not nodes or nodes[-1].kind != "if":
                    raise fail(path, item.number, "else는 같은 들여쓰기의 if 바로 다음에 와야 합니다")
                if nodes[-1].otherwise:
                    raise fail(path, item.number, "하나의 if에는 else를 하나만 사용할 수 있습니다")
                nodes[-1].otherwise = children
                continue
            elif header.startswith("unless "):
                kind, value = "unless", header[7:].strip()
            elif any(header.startswith(prefix + " ") for prefix in
                     ("as", "at", "positioned", "rotated", "facing", "anchored", "in", "align")):
                kind, value = "context", header
            else:
                raise fail(path, item.number, f"알 수 없는 블록: {header}")
            nodes.append(Node(kind, value, item.number, children, source=path))
        else:
            if text == "pass":
                kind, value = "pass", ""
            elif text.startswith("let "):
                kind, value = "let", text[4:].strip()
            elif text.startswith("call "):
                kind, value = "call", text[5:].strip()
            elif text.startswith("tell "):
                kind, value = "tell", text[5:].strip()
            elif text.startswith("title "):
                kind, value = "title", text[6:].strip()
            elif text.startswith("subtitle "):
                kind, value = "subtitle", text[9:].strip()
            elif text.startswith("actionbar "):
                kind, value = "actionbar", text[10:].strip()
            elif text.startswith("play "):
                kind, value = "play", text[5:].strip()
            elif text.startswith("/"):
                kind, value = "command", text
            else:
                kind, value = "statement", text
            nodes.append(Node(kind, value, item.number, source=path))
            pos += 1
    return nodes, pos


def parse(path: Path) -> list[Node]:
    lines = lex(path)
    if not lines:
        return []
    if lines[0].indent:
        raise fail(path, lines[0].number, "최상위 줄은 들여쓰면 안 됩니다")
    nodes, pos = parse_block(path, lines, 0, 0)
    if pos != len(lines):
        raise fail(path, lines[pos].number, "구문을 해석할 수 없습니다")
    return nodes


def literal(path: Path, node: Node, raw: str):
    try:
        return ast.literal_eval(raw)
    except (ValueError, SyntaxError):
        if re.fullmatch(r"-?\d+", raw):
            return int(raw)
        raise fail(path, node.line, "let 값은 문자열, 숫자 또는 참/거짓이어야 합니다")


def expand(text: str, variables: dict[str, object], path: Path, line: int) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in variables:
            raise fail(path, line, f"정의되지 않은 변수 {{{key}}}")
        return str(variables[key]).lower() if isinstance(variables[key], bool) else str(variables[key])
    return VAR.sub(replace, text)


def expand_bare(text: str, variables: dict[str, object]) -> str:
    """Expand compile-time constants written as bare names in BedrockPy syntax."""
    def replace(match: re.Match[str]) -> str:
        key = match.group(0)
        if key not in variables:
            return key
        value = variables[key]
        return str(value).lower() if isinstance(value, bool) else str(value)
    return re.sub(r"\b[A-Za-z_]\w*\b", replace, text)


def range_values(path: Path, node: Node, variables: dict[str, object]) -> tuple[str, range]:
    match = re.fullmatch(r"([A-Za-z_]\w*)\s+in\s+range\((.*)\)", node.value)
    if not match:
        raise fail(path, node.line, "for 문은 'for i in range(...):' 형식이어야 합니다")
    name, args_text = match.groups()
    parts = [p.strip() for p in args_text.split(",")]
    try:
        args = [int(expand(p, variables, path, node.line)) for p in parts]
        values = range(*args)
    except (ValueError, TypeError):
        raise fail(path, node.line, "range에는 1~3개의 정수만 사용할 수 있습니다") from None
    if len(parts) not in (1, 2, 3):
        raise fail(path, node.line, "range에는 1~3개의 인수가 필요합니다")
    if len(values) > 1_000_000:
        raise fail(path, node.line, "반복 횟수는 최대 1,000,000입니다")
    return name, values


@dataclass
class RuntimeVar:
    kind: str
    initial: int
    holder: str
    initial_exponent: int = 0
    exponent_holder: str | None = None


class RuntimeCompiler:
    """Compiles typed expressions to integer scoreboard operations."""

    def __init__(self, path: Path, namespace: str, declarations: list[Node]):
        self.path = path
        self.namespace = namespace
        self.objective = ("bp_" + namespace)[:16]
        self.variables: dict[str, RuntimeVar] = {}
        self.constants: dict[str, object] = {}
        self.float_exponents: dict[str, str] = {}
        self.temp_index = 0
        self.internal_index = 0
        self.internal_functions: dict[str, list[str]] = {}
        for node in declarations:
            if node.kind == "let":
                match = re.fullmatch(r"([A-Za-z_]\w*)\s*=\s*(.+)", node.value)
                if not match:
                    raise fail(node.source or path, node.line, "let은 'let 이름 = 값' 형식이어야 합니다")
                name, raw = match.groups()
                if name in self.constants or name in self.variables:
                    raise fail(node.source or path, node.line, f"중복 변수 또는 상수 이름: {name}")
                self.constants[name] = literal(node.source or path, node, raw)
                continue
            match = re.fullmatch(r"(int|float|bool)\s+([A-Za-z_]\w*)\s*=\s*(.+)", node.value)
            if not match:
                raise fail(path, node.line, "변수 선언은 'int 이름 = 값' 형식이어야 합니다")
            kind, name, raw = match.groups()
            if name in self.variables or name in self.constants:
                raise fail(node.source or path, node.line, f"중복 변수 또는 상수 이름: {name}")
            holder = f"bpv_{name}"[:37]
            initial, exponent = self._initial_value(kind, raw, node.line)
            exponent_holder = f"{holder}_e" if kind == "float" else None
            self.variables[name] = RuntimeVar(kind, initial, holder, exponent, exponent_holder)
            if exponent_holder:
                self.float_exponents[holder] = exponent_holder

    def internal_function(self, label: str, commands: list[str]) -> str:
        self.internal_index += 1
        name = f"__internal/{label}_{self.internal_index:04d}"
        self.internal_functions[name] = commands
        return name

    def _initial_value(self, kind: str, raw: str, line: int) -> tuple[int, int]:
        if kind == "bool":
            if raw not in ("true", "false", "True", "False"):
                raise fail(self.path, line, "bool 초기값은 true 또는 false여야 합니다")
            return (1 if raw.lower() == "true" else 0), 0
        try:
            number = Decimal(raw)
        except InvalidOperation:
            raise fail(self.path, line, f"{kind} 초기값은 숫자 리터럴이어야 합니다") from None
        if kind == "int" and number != number.to_integral_value():
            raise fail(self.path, line, "int 초기값에는 소수를 사용할 수 없습니다")
        if kind == "float":
            return self._decimal_float(number, line)
        return int(number), 0

    def _decimal_float(self, number: Decimal, line: int) -> tuple[int, int]:
        if not number.is_finite():
            raise fail(self.path, line, "float에는 유한한 숫자만 사용할 수 있습니다")
        if number == 0:
            return 0, 0
        adjusted = number.copy_abs().adjusted()
        if adjusted < -32 or adjusted > 32:
            raise fail(self.path, line, "float의 10진 지수 범위는 -32~32입니다")
        mantissa = int(number.scaleb(DECIMAL_FLOAT_DIGITS - 1 - adjusted))
        return mantissa, adjusted - (DECIMAL_FLOAT_DIGITS - 1)

    def init_commands(self, build_id: int, init_body: list[str], has_build_init: bool,
                      has_lifecycle: bool) -> list[str]:
        commands = [f"scoreboard objectives add {self.objective} dummy"]
        if has_build_init:
            build_guard = f"execute unless score bpi_build {self.objective} matches {build_id} run "
            for variable_name, variable in self.variables.items():
                if variable_name.startswith("__math_"):
                    continue
                commands.append(f"{build_guard}scoreboard players set {variable.holder} {self.objective} {variable.initial}")
                if variable.exponent_holder:
                    commands.append(
                        f"{build_guard}scoreboard players set {variable.exponent_holder} {self.objective} {variable.initial_exponent}")
            commands.extend(f"{build_guard}{command}" for command in init_body)
            commands.append(f"{build_guard}scoreboard players set bpi_build {self.objective} {build_id}")
        if has_lifecycle:
            commands += [f"scoreboard players add bpi_tick {self.objective} 0",
                         f"scoreboard players set bpi_one {self.objective} 1"]
        return commands

    def manual_init_commands(self, build_id: int, init_body: list[str]) -> list[str]:
        commands: list[str] = []
        for variable_name, variable in self.variables.items():
            if variable_name.startswith("__math_"):
                continue
            commands.append(
                f"scoreboard players set {variable.holder} {self.objective} {variable.initial}")
            if variable.exponent_holder:
                commands.append(
                    f"scoreboard players set {variable.exponent_holder} {self.objective} {variable.initial_exponent}")
        commands.extend(init_body)
        commands.append(f"scoreboard players set bpi_build {self.objective} {build_id}")
        return commands

    def _temp(self) -> str:
        self.temp_index += 1
        return f"bpt_{self.temp_index}"

    def _constant(self, value, line: int) -> tuple[list[str], str, str]:
        holder = self._temp()
        if isinstance(value, bool):
            kind, stored = "bool", int(value)
        elif isinstance(value, int):
            kind, stored = "int", value
        elif isinstance(value, float):
            kind = "float"
            stored, exponent = self._decimal_float(Decimal(str(value)), line)
        else:
            raise fail(self.path, line, "지원하지 않는 상수입니다")
        commands = [f"scoreboard players set {holder} {self.objective} {stored}"]
        if kind == "float":
            exponent_holder = self._temp()
            self.float_exponents[holder] = exponent_holder
            commands.append(f"scoreboard players set {exponent_holder} {self.objective} {exponent}")
        return commands, holder, kind

    def _convert(self, commands: list[str], holder: str, source: str, target: str, line: int) -> tuple[list[str], str, str]:
        if source == target or (source == "bool" and target == "int"):
            return commands, holder, target
        if source in ("int", "bool") and target == "float":
            copied = self._temp()
            exponent = self._temp()
            commands += [f"scoreboard players operation {copied} {self.objective} = {holder} {self.objective}",
                         f"scoreboard players set {exponent} {self.objective} 0"]
            self.float_exponents[copied] = exponent
            self._normalize(commands, copied, exponent)
            return commands, copied, "float"
        raise fail(self.path, line, f"{source} 값을 {target} 변수에 저장할 수 없습니다")

    def _score_constant(self, commands: list[str], value: int) -> str:
        holder = self._temp()
        commands.append(f"scoreboard players set {holder} {self.objective} {value}")
        return holder

    def _normalize(self, commands: list[str], mantissa: str, exponent: str) -> None:
        ten = self._score_constant(commands, 10)
        one = self._score_constant(commands, 1)
        for _ in range(12):
            commands += [
                f"execute if score {mantissa} {self.objective} matches {DECIMAL_FLOAT_MAX}.. run scoreboard players operation {exponent} {self.objective} += {one} {self.objective}",
                f"execute if score {mantissa} {self.objective} matches {DECIMAL_FLOAT_MAX}.. run scoreboard players operation {mantissa} {self.objective} /= {ten} {self.objective}",
                f"execute if score {mantissa} {self.objective} matches ..-{DECIMAL_FLOAT_MAX} run scoreboard players operation {exponent} {self.objective} += {one} {self.objective}",
                f"execute if score {mantissa} {self.objective} matches ..-{DECIMAL_FLOAT_MAX} run scoreboard players operation {mantissa} {self.objective} /= {ten} {self.objective}",
                f"execute if score {mantissa} {self.objective} matches 1..{DECIMAL_FLOAT_MIN - 1} run scoreboard players operation {exponent} {self.objective} -= {one} {self.objective}",
                f"execute if score {mantissa} {self.objective} matches 1..{DECIMAL_FLOAT_MIN - 1} run scoreboard players operation {mantissa} {self.objective} *= {ten} {self.objective}",
                f"execute if score {mantissa} {self.objective} matches -{DECIMAL_FLOAT_MIN - 1}..-1 run scoreboard players operation {exponent} {self.objective} -= {one} {self.objective}",
                f"execute if score {mantissa} {self.objective} matches -{DECIMAL_FLOAT_MIN - 1}..-1 run scoreboard players operation {mantissa} {self.objective} *= {ten} {self.objective}"
            ]
        commands.append(f"execute if score {mantissa} {self.objective} matches 0 run scoreboard players set {exponent} {self.objective} 0")

    def _float_copy(self, commands: list[str], mantissa: str) -> tuple[str, str]:
        copied_m = self._temp()
        copied_e = self._temp()
        commands += [f"scoreboard players operation {copied_m} {self.objective} = {mantissa} {self.objective}",
                     f"scoreboard players operation {copied_e} {self.objective} = {self.float_exponents[mantissa]} {self.objective}"]
        self.float_exponents[copied_m] = copied_e
        return copied_m, copied_e

    def _align(self, commands: list[str], left: str, right: str) -> tuple[str, str, str]:
        left, left_e = self._float_copy(commands, left)
        right, right_e = self._float_copy(commands, right)
        ten = self._score_constant(commands, 10)
        one = self._score_constant(commands, 1)
        commands += [
            f"execute if score {left} {self.objective} matches 0 run scoreboard players operation {left_e} {self.objective} = {right_e} {self.objective}",
            f"execute if score {right} {self.objective} matches 0 run scoreboard players operation {right_e} {self.objective} = {left_e} {self.objective}"
        ]
        # Eight discarded decimal digits already make the smaller operand
        # irrelevant. Ten guarded steps cover the full useful precision.
        for _ in range(10):
            commands += [
                f"execute if score {left_e} {self.objective} < {right_e} {self.objective} run scoreboard players operation {left} {self.objective} /= {ten} {self.objective}",
                f"execute if score {left_e} {self.objective} < {right_e} {self.objective} run scoreboard players operation {left_e} {self.objective} += {one} {self.objective}",
                f"execute if score {right_e} {self.objective} < {left_e} {self.objective} run scoreboard players operation {right} {self.objective} /= {ten} {self.objective}",
                f"execute if score {right_e} {self.objective} < {left_e} {self.objective} run scoreboard players operation {right_e} {self.objective} += {one} {self.objective}"
            ]
        commands += [
            f"execute if score {left} {self.objective} matches 0 run scoreboard players operation {left_e} {self.objective} = {right_e} {self.objective}",
            f"execute if score {right} {self.objective} matches 0 run scoreboard players operation {right_e} {self.objective} = {left_e} {self.objective}"
        ]
        return left, right, left_e

    def _absolute_copy(self, commands: list[str], source: str) -> str:
        target = self._temp()
        minus_one = self._score_constant(commands, -1)
        commands += [
            f"scoreboard players operation {target} {self.objective} = {source} {self.objective}",
            f"execute if score {target} {self.objective} matches ..-1 run scoreboard players operation {target} {self.objective} *= {minus_one} {self.objective}"
        ]
        return target

    def _apply_float_sign(self, commands: list[str], target: str,
                          left: str, right: str) -> None:
        left_negative, right_negative = self._temp(), self._temp()
        minus_one = self._score_constant(commands, -1)
        commands += [
            f"scoreboard players set {left_negative} {self.objective} 0",
            f"scoreboard players set {right_negative} {self.objective} 0",
            f"execute if score {left} {self.objective} matches ..-1 run scoreboard players set {left_negative} {self.objective} 1",
            f"execute if score {right} {self.objective} matches ..-1 run scoreboard players set {right_negative} {self.objective} 1",
            f"execute unless score {left_negative} {self.objective} = {right_negative} {self.objective} run scoreboard players operation {target} {self.objective} *= {minus_one} {self.objective}"
        ]

    def _decimal_multiply(self, commands: list[str], left: str,
                          right: str) -> tuple[str, str]:
        left_abs = self._absolute_copy(commands, left)
        right_abs = self._absolute_copy(commands, right)
        chunk = self._score_constant(commands, DECIMAL_FLOAT_CHUNK)
        scale = self._score_constant(commands, DECIMAL_FLOAT_MIN)
        thousand = self._score_constant(commands, 1000)
        ten = self._score_constant(commands, 10)
        left_high, left_low = self._temp(), self._temp()
        right_high, right_low = self._temp(), self._temp()
        commands += [
            f"scoreboard players operation {left_high} {self.objective} = {left_abs} {self.objective}",
            f"scoreboard players operation {left_high} {self.objective} /= {chunk} {self.objective}",
            f"scoreboard players operation {left_low} {self.objective} = {left_abs} {self.objective}",
            f"scoreboard players operation {left_low} {self.objective} %= {chunk} {self.objective}",
            f"scoreboard players operation {right_high} {self.objective} = {right_abs} {self.objective}",
            f"scoreboard players operation {right_high} {self.objective} /= {chunk} {self.objective}",
            f"scoreboard players operation {right_low} {self.objective} = {right_abs} {self.objective}",
            f"scoreboard players operation {right_low} {self.objective} %= {chunk} {self.objective}"
        ]
        p0, p1, cross, p2 = self._temp(), self._temp(), self._temp(), self._temp()
        commands += [
            f"scoreboard players operation {p0} {self.objective} = {left_low} {self.objective}",
            f"scoreboard players operation {p0} {self.objective} *= {right_low} {self.objective}",
            f"scoreboard players operation {p1} {self.objective} = {left_high} {self.objective}",
            f"scoreboard players operation {p1} {self.objective} *= {right_low} {self.objective}",
            f"scoreboard players operation {cross} {self.objective} = {left_low} {self.objective}",
            f"scoreboard players operation {cross} {self.objective} *= {right_high} {self.objective}",
            f"scoreboard players operation {p1} {self.objective} += {cross} {self.objective}",
            f"scoreboard players operation {p2} {self.objective} = {left_high} {self.objective}",
            f"scoreboard players operation {p2} {self.objective} *= {right_high} {self.objective}"
        ]
        p1_high, p1_low, tail = self._temp(), self._temp(), self._temp()
        target = self._temp()
        commands += [
            f"scoreboard players operation {p1_high} {self.objective} = {p1} {self.objective}",
            f"scoreboard players operation {p1_high} {self.objective} /= {thousand} {self.objective}",
            f"scoreboard players operation {p1_low} {self.objective} = {p1} {self.objective}",
            f"scoreboard players operation {p1_low} {self.objective} %= {thousand} {self.objective}",
            f"scoreboard players operation {tail} {self.objective} = {p1_low} {self.objective}",
            f"scoreboard players operation {tail} {self.objective} *= {chunk} {self.objective}",
            f"scoreboard players operation {tail} {self.objective} += {p0} {self.objective}",
            f"scoreboard players operation {tail} {self.objective} /= {scale} {self.objective}",
            f"scoreboard players operation {target} {self.objective} = {p2} {self.objective}",
            f"scoreboard players operation {target} {self.objective} *= {ten} {self.objective}",
            f"scoreboard players operation {target} {self.objective} += {p1_high} {self.objective}",
            f"scoreboard players operation {target} {self.objective} += {tail} {self.objective}"
        ]
        self._apply_float_sign(commands, target, left, right)
        exponent = self._temp()
        commands += [
            f"scoreboard players operation {exponent} {self.objective} = {self.float_exponents[left]} {self.objective}",
            f"scoreboard players operation {exponent} {self.objective} += {self.float_exponents[right]} {self.objective}",
            f"scoreboard players add {exponent} {self.objective} {DECIMAL_FLOAT_DIGITS - 1}"
        ]
        return target, exponent

    def _decimal_divide(self, commands: list[str], left: str,
                        right: str) -> tuple[str, str]:
        remainder = self._absolute_copy(commands, left)
        divisor = self._absolute_copy(commands, right)
        ten = self._score_constant(commands, 10)
        quotient = self._temp()
        commands.append(f"scoreboard players set {quotient} {self.objective} 0")
        # One guard digit ensures ratios below 1 still keep eight significant
        # digits; ratios above 1 are normalized down afterward.
        for _ in range(DECIMAL_FLOAT_DIGITS + 1):
            digit = self._temp()
            commands += [
                f"scoreboard players operation {digit} {self.objective} = {remainder} {self.objective}",
                f"scoreboard players operation {digit} {self.objective} /= {divisor} {self.objective}",
                f"scoreboard players operation {quotient} {self.objective} *= {ten} {self.objective}",
                f"scoreboard players operation {quotient} {self.objective} += {digit} {self.objective}",
                f"scoreboard players operation {remainder} {self.objective} %= {divisor} {self.objective}",
                f"scoreboard players operation {remainder} {self.objective} *= {ten} {self.objective}"
            ]
        commands.append(
            f"execute if score {right} {self.objective} matches 0 run scoreboard players set {quotient} {self.objective} 0")
        self._apply_float_sign(commands, quotient, left, right)
        exponent = self._temp()
        commands += [
            f"scoreboard players operation {exponent} {self.objective} = {self.float_exponents[left]} {self.objective}",
            f"scoreboard players operation {exponent} {self.objective} -= {self.float_exponents[right]} {self.objective}",
            f"scoreboard players remove {exponent} {self.objective} {DECIMAL_FLOAT_DIGITS}"
        ]
        return quotient, exponent

    def expression(self, text: str, line: int) -> tuple[list[str], str, str]:
        try:
            normalized = re.sub(r"\btrue\b", "True", text, flags=re.IGNORECASE)
            normalized = re.sub(r"\bfalse\b", "False", normalized, flags=re.IGNORECASE)
            tree = ast.parse(normalized, mode="eval").body
        except (SyntaxError, tokenize.TokenError):
            raise fail(self.path, line, f"잘못된 연산식: {text}") from None
        return self._expr(tree, line)

    def _expr(self, node: ast.AST, line: int) -> tuple[list[str], str, str]:
        if isinstance(node, ast.Constant):
            return self._constant(node.value, line)
        if isinstance(node, ast.Name):
            if node.id not in self.variables:
                raise fail(self.path, line, f"정의되지 않은 scoreboard 변수: {node.id}")
            variable = self.variables[node.id]
            return [], variable.holder, variable.kind
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            return self._math_call(node.func.id, node.args, line)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            commands, source, kind = self._expr(node.operand, line)
            target = self._temp()
            commands += [f"scoreboard players set {target} {self.objective} 0",
                         f"scoreboard players operation {target} {self.objective} -= {source} {self.objective}"]
            if kind == "float":
                exponent = self._temp()
                commands.append(f"scoreboard players operation {exponent} {self.objective} = {self.float_exponents[source]} {self.objective}")
                self.float_exponents[target] = exponent
            return commands, target, kind
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            commands, source, kind = self._expr(node.operand, line)
            if kind != "bool":
                raise fail(self.path, line, "not 연산에는 bool 값이 필요합니다")
            target = self._temp()
            commands += [f"scoreboard players set {target} {self.objective} 1",
                         f"execute if score {source} {self.objective} matches 1 run scoreboard players set {target} {self.objective} 0"]
            return commands, target, "bool"
        if isinstance(node, ast.BoolOp) and isinstance(node.op, (ast.And, ast.Or)):
            values = [self._expr(value, line) for value in node.values]
            if any(kind != "bool" for _, _, kind in values):
                raise fail(self.path, line, "and/or 연산에는 bool 값이 필요합니다")
            commands = [command for item, _, _ in values for command in item]
            target = self._temp()
            if isinstance(node.op, ast.And):
                commands.append(f"scoreboard players set {target} {self.objective} 1")
                for _, source, _ in values:
                    commands.append(f"execute unless score {source} {self.objective} matches 1 run scoreboard players set {target} {self.objective} 0")
            else:
                commands.append(f"scoreboard players set {target} {self.objective} 0")
                for _, source, _ in values:
                    commands.append(f"execute if score {source} {self.objective} matches 1 run scoreboard players set {target} {self.objective} 1")
            return commands, target, "bool"
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod)):
            left_cmds, left, left_kind = self._expr(node.left, line)
            right_cmds, right, right_kind = self._expr(node.right, line)
            result_kind = "float" if "float" in (left_kind, right_kind) else "int"
            left_cmds, left, _ = self._convert(left_cmds, left, left_kind, result_kind, line)
            right_cmds, right, _ = self._convert(right_cmds, right, right_kind, result_kind, line)
            commands = left_cmds + right_cmds
            operator = {ast.Add: "+=", ast.Sub: "-=", ast.Mult: "*=", ast.Div: "/=", ast.Mod: "%="}[type(node.op)]
            target = self._temp()
            if result_kind != "float":
                commands += [f"scoreboard players operation {target} {self.objective} = {left} {self.objective}",
                             f"scoreboard players operation {target} {self.objective} {operator} {right} {self.objective}"]
                return commands, target, result_kind
            if isinstance(node.op, (ast.Add, ast.Sub, ast.Mod)):
                left, right, exponent = self._align(commands, left, right)
                commands += [f"scoreboard players operation {target} {self.objective} = {left} {self.objective}",
                             f"scoreboard players operation {target} {self.objective} {operator} {right} {self.objective}"]
            elif isinstance(node.op, ast.Mult):
                target, exponent = self._decimal_multiply(commands, left, right)
            else:
                target, exponent = self._decimal_divide(commands, left, right)
            self.float_exponents[target] = exponent
            self._normalize(commands, target, exponent)
            return commands, target, result_kind
        if isinstance(node, ast.Compare) and len(node.ops) == 1:
            left_cmds, left, left_kind = self._expr(node.left, line)
            right_cmds, right, right_kind = self._expr(node.comparators[0], line)
            common = "float" if "float" in (left_kind, right_kind) else "int"
            left_cmds, left, _ = self._convert(left_cmds, left, left_kind, common, line)
            right_cmds, right, _ = self._convert(right_cmds, right, right_kind, common, line)
            operators = {ast.Eq: "=", ast.NotEq: "!=", ast.Lt: "<", ast.LtE: "<=", ast.Gt: ">", ast.GtE: ">="}
            if type(node.ops[0]) not in operators:
                raise fail(self.path, line, "지원하지 않는 비교 연산자입니다")
            target = self._temp()
            commands = left_cmds + right_cmds
            if common == "float":
                left, right, _ = self._align(commands, left, right)
            commands.append(f"scoreboard players set {target} {self.objective} 0")
            op = operators[type(node.ops[0])]
            if op == "!=":
                commands.append(f"execute unless score {left} {self.objective} = {right} {self.objective} run scoreboard players set {target} {self.objective} 1")
            else:
                commands.append(f"execute if score {left} {self.objective} {op} {right} {self.objective} run scoreboard players set {target} {self.objective} 1")
            return commands, target, "bool"
        raise fail(self.path, line, "지원하는 연산은 +, -, *, /, %, 비교, and, or, not입니다")

    def _bind_math_value(self, holder: str, kind: str) -> str:
        name = f"__math_{self.temp_index}_{len(self.variables)}"
        exponent = self.float_exponents.get(holder)
        self.variables[name] = RuntimeVar(kind, 0, holder, 0, exponent)
        return name

    def _parse_math(self, expression: str, line: int) -> tuple[list[str], str, str]:
        return self._expr(ast.parse(expression, mode="eval").body, line)

    def _math_call(self, name: str, args: list[ast.AST], line: int) -> tuple[list[str], str, str]:
        supported = {"sqrt", "root", "pow", "abs", "sin", "cos", "tan", "log", "max", "min"}
        if name not in supported:
            raise fail(self.path, line, f"지원하지 않는 수학 함수: {name}")
        if not args:
            raise fail(self.path, line, f"{name} 함수에 값이 필요합니다")

        if name in ("max", "min"):
            if len(args) < 2:
                raise fail(self.path, line, f"{name}는 인수를 두 개 이상 받아야 합니다")
            values = [self._expr(arg, line) for arg in args]
            if any(kind not in ("int", "float") for _, _, kind in values):
                raise fail(self.path, line, f"{name}에는 int 또는 float 값만 사용할 수 있습니다")
            result_kind = "float" if any(kind == "float" for _, _, kind in values) else "int"
            commands: list[str] = []
            converted: list[str] = []
            for value_commands, holder, kind in values:
                value_commands, holder, _ = self._convert(
                    value_commands, holder, kind, result_kind, line)
                commands += value_commands
                converted.append(holder)
            target = self._temp()
            commands.append(
                f"scoreboard players operation {target} {self.objective} = {converted[0]} {self.objective}")
            target_exponent: str | None = None
            if result_kind == "float":
                target_exponent = self._temp()
                commands.append(
                    f"scoreboard players operation {target_exponent} {self.objective} = {self.float_exponents[converted[0]]} {self.objective}")
                self.float_exponents[target] = target_exponent
            comparison = ">" if name == "max" else "<"
            for candidate in converted[1:]:
                condition = self._temp()
                commands.append(f"scoreboard players set {condition} {self.objective} 0")
                if result_kind == "float":
                    aligned_target, aligned_candidate, _ = self._align(commands, target, candidate)
                    left, right = aligned_candidate, aligned_target
                else:
                    left, right = candidate, target
                commands += [
                    f"execute if score {left} {self.objective} {comparison} {right} {self.objective} run scoreboard players set {condition} {self.objective} 1",
                    f"execute if score {condition} {self.objective} matches 1 run scoreboard players operation {target} {self.objective} = {candidate} {self.objective}",
                ]
                if result_kind == "float" and target_exponent is not None:
                    commands.append(
                        f"execute if score {condition} {self.objective} matches 1 run scoreboard players operation {target_exponent} {self.objective} = {self.float_exponents[candidate]} {self.objective}")
            return commands, target, result_kind

        commands, source, kind = self._expr(args[0], line)
        value_name = self._bind_math_value(source, kind)

        if name == "abs":
            if len(args) != 1:
                raise fail(self.path, line, "abs는 인수 하나만 받습니다")
            target = self._temp()
            minus_one = self._score_constant(commands, -1)
            commands += [f"scoreboard players operation {target} {self.objective} = {source} {self.objective}",
                         f"execute if score {target} {self.objective} matches ..-1 run scoreboard players operation {target} {self.objective} *= {minus_one} {self.objective}"]
            if kind == "float":
                exponent = self._temp()
                commands.append(f"scoreboard players operation {exponent} {self.objective} = {self.float_exponents[source]} {self.objective}")
                self.float_exponents[target] = exponent
            return commands, target, kind

        if name == "pow":
            if len(args) != 2 or not isinstance(args[1], ast.Constant) or not isinstance(args[1].value, int):
                raise fail(self.path, line, "pow는 'pow(값, -8~8 정수)' 형식이어야 합니다")
            exponent = args[1].value
            if not -8 <= exponent <= 8:
                raise fail(self.path, line, "pow 지수는 -8~8이어야 합니다")
            if exponent == 0:
                extra, result, result_kind = self._constant(1.0 if kind == "float" else 1, line)
                return commands + extra, result, result_kind
            product = " * ".join([value_name] * abs(exponent))
            expression = f"1.0 / ({product})" if exponent < 0 else product
            extra, result, result_kind = self._parse_math(expression, line)
            return commands + extra, result, result_kind

        if name in ("sqrt", "root"):
            degree = 2
            if name == "sqrt":
                if len(args) != 1:
                    raise fail(self.path, line, "sqrt는 인수 하나만 받습니다")
            else:
                if len(args) != 2 or not isinstance(args[1], ast.Constant) or not isinstance(args[1].value, int):
                    raise fail(self.path, line, "root는 'root(값, 2~8 정수)' 형식이어야 합니다")
                degree = args[1].value
                if not 2 <= degree <= 8:
                    raise fail(self.path, line, "root 차수는 2~8이어야 합니다")
            guess_cmds, guess, _ = self._constant(1.0, line)
            commands += guess_cmds
            guess_name = self._bind_math_value(guess, "float")
            source_float_cmds, source_float, _ = self._convert([], source, kind, "float", line)
            commands += source_float_cmds
            value_name = self._bind_math_value(source_float, "float")
            for _ in range(7):
                denominator = " * ".join([guess_name] * (degree - 1))
                step = f"(({degree - 1}.0 * {guess_name}) + ({value_name} / ({denominator}))) / {degree}.0"
                step_cmds, guess, _ = self._parse_math(step, line)
                commands += step_cmds
                guess_name = self._bind_math_value(guess, "float")
            return commands, guess, "float"

        source_float_cmds, source_float, _ = self._convert([], source, kind, "float", line)
        commands += source_float_cmds
        value_name = self._bind_math_value(source_float, "float")

        if name in ("sin", "cos", "tan"):
            reduced_cmds, reduced, _ = self._parse_math(f"{value_name} % 6.283185", line)
            commands += reduced_cmds
            x = self._bind_math_value(reduced, "float")
            for comparison, adjustment in ((f"{x} > 3.141592", f"{x} - 6.283185"),
                                           (f"{x} < -3.141592", f"{x} + 6.283185")):
                condition_cmds, condition, _ = self._parse_math(comparison, line)
                candidate_cmds, candidate, _ = self._parse_math(adjustment, line)
                commands += condition_cmds + candidate_cmds + [
                    f"execute if score {condition} {self.objective} matches 1 run scoreboard players operation {reduced} {self.objective} = {candidate} {self.objective}",
                    f"execute if score {condition} {self.objective} matches 1 run scoreboard players operation {self.float_exponents[reduced]} {self.objective} = {self.float_exponents[candidate]} {self.objective}"
                ]
            power_names: list[str] = []
            power_cmds, power, _ = self._parse_math(f"{x} * {x}", line)
            commands += power_cmds
            power_names.append(self._bind_math_value(power, "float"))
            for _ in range(3):
                power_cmds, power, _ = self._parse_math(f"{power_names[-1]} * {power_names[0]}", line)
                commands += power_cmds
                power_names.append(self._bind_math_value(power, "float"))
            x2, x4, x6, x8 = power_names
            sin_expr = f"{x} * (1.0 - {x2}/6.0 + {x4}/120.0 - {x6}/5040.0 + {x8}/362880.0)"
            cos_expr = f"1.0 - {x2}/2.0 + {x4}/24.0 - {x6}/720.0 + {x8}/40320.0"
            expression = sin_expr if name == "sin" else cos_expr
            if name == "tan":
                expression = f"({sin_expr}) / ({cos_expr})"
            extra, result, _ = self._parse_math(expression, line)
            return commands + extra, result, "float"

        if len(args) not in (1, 2):
            raise fail(self.path, line, "log는 log(값) 또는 log(값, 밑) 형식이어야 합니다")
        def log_series(bound_holder: str) -> tuple[list[str], str]:
            local: list[str] = []
            reduced, reduced_e = self._float_copy(local, bound_holder)
            local.append(f"scoreboard players set {reduced_e} {self.objective} -{DECIMAL_FLOAT_DIGITS - 1}")
            reduced_name = self._bind_math_value(reduced, "float")
            halves = self._temp()
            local.append(f"scoreboard players set {halves} {self.objective} 0")
            one = self._score_constant(local, 1)
            for _ in range(3):
                condition_cmds, condition, _ = self._parse_math(f"{reduced_name} >= 2.0", line)
                candidate_cmds, candidate, _ = self._parse_math(f"{reduced_name} / 2.0", line)
                local += condition_cmds + candidate_cmds + [
                    f"execute if score {condition} {self.objective} matches 1 run scoreboard players operation {reduced} {self.objective} = {candidate} {self.objective}",
                    f"execute if score {condition} {self.objective} matches 1 run scoreboard players operation {reduced_e} {self.objective} = {self.float_exponents[candidate]} {self.objective}",
                    f"execute if score {condition} {self.objective} matches 1 run scoreboard players operation {halves} {self.objective} += {one} {self.objective}"
                ]
            decimal_exponent = self._temp()
            local += [
                f"scoreboard players operation {decimal_exponent} {self.objective} = {self.float_exponents[bound_holder]} {self.objective}",
                f"scoreboard players add {decimal_exponent} {self.objective} {DECIMAL_FLOAT_DIGITS - 1}"
            ]
            halves_name = self._bind_math_value(halves, "int")
            exponent_name = self._bind_math_value(decimal_exponent, "int")
            y_cmds, y_value, _ = self._parse_math(f"({reduced_name} - 1.0) / ({reduced_name} + 1.0)", line)
            local += y_cmds
            y_name = self._bind_math_value(y_value, "float")
            y2_cmds, y2_value, _ = self._parse_math(f"{y_name} * {y_name}", line)
            local += y2_cmds
            y2_name = self._bind_math_value(y2_value, "float")
            powers = [y_name]
            for _ in range(5):
                p_cmds, p_value, _ = self._parse_math(f"{powers[-1]} * {y2_name}", line)
                local += p_cmds
                powers.append(self._bind_math_value(p_value, "float"))
            terms = " + ".join(f"{power}/{index * 2 + 1}.0" if index else power
                               for index, power in enumerate(powers))
            expression = (f"2.0 * ({terms}) + {halves_name} * 0.69314718 + "
                          f"{exponent_name} * 2.3025851")
            return local, expression

        series_cmds, ln_expr = log_series(source_float)
        commands += series_cmds
        if len(args) == 2:
            base_cmds, base, base_kind = self._expr(args[1], line)
            commands += base_cmds
            base_float_cmds, base, _ = self._convert([], base, base_kind, "float", line)
            commands += base_float_cmds
            base_series_cmds, base_ln = log_series(base)
            commands += base_series_cmds
            ln_expr = f"({ln_expr}) / ({base_ln})"
        extra, result, _ = self._parse_math(ln_expr, line)
        return commands + extra, result, "float"

    def assignment(self, text: str, line: int) -> list[str]:
        match = re.fullmatch(r"([A-Za-z_]\w*)\s*(=|\+=|-=|\*=|/=|%=)\s*(.+)", text)
        if not match:
            raise fail(self.path, line, "알 수 없는 문장입니다. Minecraft 명령이라면 '/'로 시작하세요")
        name, operator, expression = match.groups()
        if name not in self.variables:
            raise fail(self.path, line, f"정의되지 않은 scoreboard 변수: {name}")
        target = self.variables[name]
        commands, source, source_kind = self.expression(expression, line)
        commands, source, _ = self._convert(commands, source, source_kind, target.kind, line)
        if target.kind == "bool" and operator != "=":
            raise fail(self.path, line, "bool에는 복합 산술 대입을 사용할 수 없습니다")
        if target.kind == "float" and operator != "=":
            return self.assignment(f"{name} = {name} {operator[0]} ({expression})", line)
        commands.append(f"scoreboard players operation {target.holder} {self.objective} {operator} {source} {self.objective}")
        if target.kind == "float":
            commands.append(f"scoreboard players operation {target.exponent_holder} {self.objective} = {self.float_exponents[source]} {self.objective}")
        return commands

    def rotation(self, text: str, line: int) -> list[str]:
        match = re.fullmatch(
            r"(\S+)\s*->\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)", text)
        if not match:
            raise fail(self.path, line,
                       "rotation은 'rotation @대상 -> pitch변수, yaw변수' 형식이어야 합니다")
        selector, pitch_name, yaw_name = match.groups()
        if not selector.startswith("@"):
            raise fail(self.path, line, "rotation 대상에는 @s, @a 같은 선택자가 필요합니다")
        if pitch_name == yaw_name:
            raise fail(self.path, line, "pitch와 yaw는 서로 다른 변수에 저장해야 합니다")
        for variable_name in (pitch_name, yaw_name):
            if variable_name not in self.variables:
                raise fail(self.path, line, f"정의되지 않은 scoreboard 변수: {variable_name}")
            if self.variables[variable_name].kind not in ("int", "float"):
                raise fail(self.path, line, "rotation 결과는 int 또는 float 변수에 저장해야 합니다")

        def leaf_commands(axis: str, variable_name: str, value: int) -> list[str]:
            variable = self.variables[variable_name]
            if variable.kind == "int":
                return [f"scoreboard players set {variable.holder} {self.objective} {value}"]
            maximum = "rxm" if axis == "pitch" else "rym"
            mantissa, exponent = self._decimal_float(Decimal(value), line)
            commands = [
                f"scoreboard players set {variable.holder} {self.objective} {mantissa}",
                f"scoreboard players set {variable.exponent_holder} {self.objective} {exponent}"
            ]
            for tenth in range(1, 10):
                angle = Decimal(value) + Decimal(tenth) / 10
                mantissa, exponent = self._decimal_float(angle, line)
                angle_text = format(angle, "f")
                commands += [
                    f"execute if entity @s[{maximum}={angle_text}] run scoreboard players set {variable.holder} {self.objective} {mantissa}",
                    f"execute if entity @s[{maximum}={angle_text}] run scoreboard players set {variable.exponent_holder} {self.objective} {exponent}"
                ]
            return commands

        def tree(axis: str, variable_name: str, low: int, high: int) -> str:
            if low == high:
                return self.internal_function(
                    f"rotation_{axis}_leaf", leaf_commands(axis, variable_name, low))
            middle = (low + high) // 2
            left = tree(axis, variable_name, low, middle)
            right = tree(axis, variable_name, middle + 1, high)
            minimum = "rxm" if axis == "pitch" else "rym"
            probe = f"@s[{minimum}={middle + 1}]"
            return self.internal_function(f"rotation_{axis}", [
                f"execute unless entity {probe} run function {self.namespace}/{left}",
                f"execute if entity {probe} run function {self.namespace}/{right}"
            ])

        pitch_root = tree("pitch", pitch_name, -90, 90)
        yaw_root = tree("yaw", yaw_name, -180, 179)
        return [
            f"execute as {selector} run function {self.namespace}/{pitch_root}",
            f"execute as {selector} run function {self.namespace}/{yaw_root}"
        ]

    def location(self, text: str, line: int) -> list[str]:
        match = re.fullmatch(
            r"(\S+)\s*->\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)", text)
        if not match:
            raise fail(self.path, line,
                       "location은 'location @대상 -> x변수, y변수, z변수' 형식이어야 합니다")
        selector, x_name, y_name, z_name = match.groups()
        if not selector.startswith("@"):
            raise fail(self.path, line, "location 대상에는 @s, @a 같은 선택자가 필요합니다")
        if len({x_name, y_name, z_name}) != 3:
            raise fail(self.path, line, "x, y, z는 서로 다른 변수에 저장해야 합니다")
        for variable_name in (x_name, y_name, z_name):
            if variable_name not in self.variables:
                raise fail(self.path, line, f"정의되지 않은 scoreboard 변수: {variable_name}")
            if self.variables[variable_name].kind not in ("int", "float"):
                raise fail(self.path, line, "location 결과는 int 또는 float 변수에 저장해야 합니다")

        marker = "@e[type=armor_stand,tag=bpi_location_marker,c=1]"
        target = "@e[tag=bpi_location_target,c=1]"
        commands = [
            "tag @e[tag=bpi_location_target] remove bpi_location_target",
            "kill @e[type=armor_stand,tag=bpi_location_marker]",
            "tag @s add bpi_location_target",
            "summon armor_stand 0 1000 0",
            "tag @e[type=armor_stand,x=0,y=1000,z=0,r=2,tag=!bpi_location_marker,c=1] add bpi_location_marker",
            f"effect {marker} invisibility 999999 0 true"
        ]

        def horizontal(axis: str, variable_name: str) -> None:
            nonlocal commands
            result, direction = self._temp(), self._temp()
            world_min = -29_999_984
            commands += [
                f"scoreboard players set {result} {self.objective} {world_min}",
                f"tp {marker} {f'{world_min} 1000 0' if axis == 'x' else f'0 1000 {world_min}'}"
            ]
            variable = self.variables[variable_name]
            step = 1 << 25
            while step >= 1:
                # 선택자는 대상 엔티티의 히트박스와 겹치기만 해도 성공한다.
                # 플레이어 중심 좌표를 int로 구할 때는 히트박스 반폭(0.3)을
                # 탐색 경계에 더해 정수 경계가 소수부 0.0에 오도록 맞춘다.
                probe_step = (f"{step}.3" if variable.kind == "int" else str(step))
                if axis == "x":
                    probe = (f"execute at {marker} positioned ~{probe_step} ~-1200 ~-35000000 "
                             "if entity @e[tag=bpi_location_target,c=1,dx=70000000,dy=1400,dz=70000000]")
                    positive_tp = f"~{step} ~ ~"
                else:
                    probe = (f"execute at {marker} positioned ~-35000000 ~-1200 ~{probe_step} "
                             "if entity @e[tag=bpi_location_target,c=1,dx=70000000,dy=1400,dz=70000000]")
                    positive_tp = f"~ ~ ~{step}"
                commands += [
                    f"scoreboard players set {direction} {self.objective} 0",
                    f"{probe} run scoreboard players set {direction} {self.objective} 1",
                    f"execute if score {direction} {self.objective} matches 1 run scoreboard players add {result} {self.objective} {step}",
                    f"execute if score {direction} {self.objective} matches 1 as {marker} at @s run tp @s {positive_tp}"
                ]
                step //= 2
            if variable.kind == "int":
                commands.append(
                    f"scoreboard players operation {variable.holder} {self.objective} = {result} {self.objective}")
                return
            tenth = self._temp()
            commands.append(f"scoreboard players set {tenth} {self.objective} 0")
            for digit in range(1, 10):
                offset = f"{digit / 10:.1f}"
                if axis == "x":
                    probe = (f"execute at {marker} positioned ~{offset} ~-1200 ~-35000000 "
                             "if entity @e[tag=bpi_location_target,c=1,dx=70000000,dy=1400,dz=70000000]")
                else:
                    probe = (f"execute at {marker} positioned ~-35000000 ~-1200 ~{offset} "
                             "if entity @e[tag=bpi_location_target,c=1,dx=70000000,dy=1400,dz=70000000]")
                commands.append(
                    f"{probe} run scoreboard players set {tenth} {self.objective} {digit}")
            integer_name = self._bind_math_value(result, "int")
            tenth_name = self._bind_math_value(tenth, "int")
            value_commands, value, _ = self._parse_math(
                f"{integer_name} + {tenth_name} / 10.0 - 0.3", line)
            commands.extend(value_commands)
            commands += [
                f"scoreboard players operation {variable.holder} {self.objective} = {value} {self.objective}",
                f"scoreboard players operation {variable.exponent_holder} {self.objective} = {self.float_exponents[value]} {self.objective}"
            ]

        horizontal("x", x_name)
        horizontal("z", z_name)

        def lower_y_probe(coordinate: Decimal | int) -> str:
            value = Decimal(coordinate)
            box_y = Decimal("-512")
            dy = value - box_y
            return (f"@s[x=-30000000,y={format(box_y, 'f')},z=-30000000,"
                    f"dx=60000000,dy={format(dy, 'f')},dz=60000000]")

        def y_leaf(value: int) -> list[str]:
            variable = self.variables[y_name]
            if variable.kind == "int":
                body = [f"scoreboard players set {variable.holder} {self.objective} {value + 1}"]
                for digit in range(9, 0, -1):
                    coordinate = Decimal(value - 1) + Decimal(digit) / 10
                    body.append(
                        f"execute if entity {lower_y_probe(coordinate)} run scoreboard players set {variable.holder} {self.objective} {value}")
                return body
            coordinate = Decimal(value) + 1
            mantissa, exponent = self._decimal_float(coordinate, line)
            body = [f"scoreboard players set {variable.holder} {self.objective} {mantissa}",
                    f"scoreboard players set {variable.exponent_holder} {self.objective} {exponent}"]
            for digit in range(9, 0, -1):
                coordinate = Decimal(value - 1) + Decimal(digit) / 10
                mantissa, exponent = self._decimal_float(coordinate + 1, line)
                body += [
                    f"execute if entity {lower_y_probe(coordinate)} run scoreboard players set {variable.holder} {self.objective} {mantissa}",
                    f"execute if entity {lower_y_probe(coordinate)} run scoreboard players set {variable.exponent_holder} {self.objective} {exponent}"
                ]
            return body

        def y_tree(low: int, high: int) -> str:
            if low == high:
                return self.internal_function("location_y_leaf", y_leaf(low))
            middle = (low + high) // 2
            left, right = y_tree(low, middle), y_tree(middle + 1, high)
            probe = lower_y_probe(middle)
            return self.internal_function("location_y", [
                f"execute if entity {probe} run function {self.namespace}/{left}",
                f"execute unless entity {probe} run function {self.namespace}/{right}"
            ])

        y_root = y_tree(-64, 319)
        commands += [
            f"function {self.namespace}/{y_root}",
            "tag @s remove bpi_location_target",
            f"kill {marker}"
        ]
        body = self.internal_function("location", commands)
        return [f"execute as {selector} at @s run function {self.namespace}/{body}"]

    def teleport(self, text: str, line: int) -> list[str]:
        operand = r"(?:[A-Za-z_]\w*|[+-]?(?:\d+(?:\.\d*)?|\.\d+))"
        match = re.fullmatch(
            rf"(\S+)\s*->\s*({operand})\s*,\s*({operand})\s*,\s*({operand})"
            rf"(?:\s*,\s*({operand})\s*,\s*({operand}))?", text)
        if not match:
            raise fail(self.path, line,
                       "tp는 'tp @대상 -> x, y, z[, ry, rx]' 형식이어야 하며 각 값에는 숫자 또는 변수를 사용할 수 있습니다")
        selector, x_name, y_name, z_name, yaw_name, pitch_name = match.groups()
        if not selector.startswith("@"):
            raise fail(self.path, line, "tp 대상에는 @s, @a 같은 선택자가 필요합니다")
        names = [x_name, y_name, z_name] + ([yaw_name, pitch_name] if yaw_name and pitch_name else [])
        number_pattern = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)")
        for value in names:
            if number_pattern.fullmatch(value):
                scaled_value = int(Decimal(value) * 10)
                if not -2_147_483_648 <= scaled_value <= 2_147_483_647:
                    raise fail(self.path, line, f"tp 숫자 상수가 scoreboard 범위를 벗어났습니다: {value}")
                continue
            if value not in self.variables:
                raise fail(self.path, line, f"정의되지 않은 scoreboard 변수: {value}")
            if self.variables[value].kind not in ("int", "float"):
                raise fail(self.path, line, "tp에는 int 또는 float 변수만 사용할 수 있습니다")

        # 모든 값이 리터럴이면 scoreboard/armor stand 좌표 계산 없이 원본 tp로 충분하다.
        if all(number_pattern.fullmatch(value) for value in names):
            coordinates = f"{x_name} {y_name} {z_name}"
            rotation = f" {yaw_name} {pitch_name}" if yaw_name and pitch_name else ""
            return [f"tp {selector} {coordinates}{rotation}"]

        marker = "@e[type=armor_stand,tag=bpi_tp_marker,c=1]"
        commands = [
            "kill @e[type=armor_stand,tag=bpi_tp_marker]",
            "summon armor_stand 0 1000 0",
            "tag @e[type=armor_stand,x=0,y=1000,z=0,r=2,tag=!bpi_tp_marker,c=1] add bpi_tp_marker",
            f"effect {marker} invisibility 999999 0 true"
        ]

        def tenths(value: str) -> str:
            nonlocal commands
            scaled = self._temp()
            if number_pattern.fullmatch(value):
                commands.append(
                    f"scoreboard players set {scaled} {self.objective} {int(Decimal(value) * 10)}")
                return scaled
            variable = self.variables[value]
            if variable.kind == "int":
                ten = self._score_constant(commands, 10)
                commands += [
                    f"scoreboard players operation {scaled} {self.objective} = {variable.holder} {self.objective}",
                    f"scoreboard players operation {scaled} {self.objective} *= {ten} {self.objective}"
                ]
                return scaled
            exponent = self._temp()
            commands += [
                f"scoreboard players operation {scaled} {self.objective} = {variable.holder} {self.objective}",
                f"scoreboard players operation {exponent} {self.objective} = {variable.exponent_holder} {self.objective}"
            ]
            ten = self._score_constant(commands, 10)
            one = self._score_constant(commands, 1)
            for _ in range(64):
                commands += [
                    f"execute if score {exponent} {self.objective} matches ..-2 run scoreboard players operation {scaled} {self.objective} /= {ten} {self.objective}",
                    f"execute if score {exponent} {self.objective} matches ..-2 run scoreboard players operation {exponent} {self.objective} += {one} {self.objective}",
                    f"execute if score {exponent} {self.objective} matches 0.. run scoreboard players operation {scaled} {self.objective} *= {ten} {self.objective}",
                    f"execute if score {exponent} {self.objective} matches 0.. run scoreboard players operation {exponent} {self.objective} -= {one} {self.objective}"
                ]
            return scaled

        def move_marker(score: str, axis: str) -> None:
            nonlocal commands
            if axis == "y":
                commands.append(f"scoreboard players remove {score} {self.objective} 10000")
            step = 1 << 29
            while step >= 1:
                amount = step // 10 if step % 10 == 0 else step / 10
                if axis == "x":
                    positive, negative = f"~{amount} ~ ~", f"~-{amount} ~ ~"
                elif axis == "y":
                    positive, negative = f"~ ~{amount} ~", f"~ ~-{amount} ~"
                else:
                    positive, negative = f"~ ~ ~{amount}", f"~ ~ ~-{amount}"
                commands += [
                    f"execute if score {score} {self.objective} matches {step}.. as {marker} at @s run tp @s {positive}",
                    f"execute if score {score} {self.objective} matches {step}.. run scoreboard players remove {score} {self.objective} {step}",
                    f"execute if score {score} {self.objective} matches ..-{step} as {marker} at @s run tp @s {negative}",
                    f"execute if score {score} {self.objective} matches ..-{step} run scoreboard players add {score} {self.objective} {step}"
                ]
                step //= 2

        for value, axis in ((x_name, "x"), (y_name, "y"), (z_name, "z")):
            if not number_pattern.fullmatch(value):
                move_marker(tenths(value), axis)

        # 상수 축은 마지막 원본 tp에 직접 넣고, 변수 축만 marker가 계산한 좌표를 사용한다.
        position_parts = [
            x_name if number_pattern.fullmatch(x_name) else "~-0.5",
            y_name if number_pattern.fullmatch(y_name) else "~",
            z_name if number_pattern.fullmatch(z_name) else "~-0.5",
        ]
        rotation_parts: list[str] = []
        if yaw_name and pitch_name:
            rotation_parts = [
                yaw_name if number_pattern.fullmatch(yaw_name) else "~",
                pitch_name if number_pattern.fullmatch(pitch_name) else "~",
            ]
        commands.append(
            f"execute at {marker} run tp @s {' '.join(position_parts + rotation_parts)}")

        def apply_rotation(variable_name: str, axis: str, low: int, high: int) -> str:
            score = tenths(variable_name)

            def leaf(value: int) -> list[str]:
                literal = value // 10 if value % 10 == 0 else value / 10
                if axis == "yaw":
                    return [f"execute if score {score} {self.objective} matches {value} run tp @s ~ ~ ~ {literal} ~"]
                return [f"execute if score {score} {self.objective} matches {value} run tp @s ~ ~ ~ ~ {literal}"]

            def tree(start: int, end: int) -> str:
                if start == end:
                    return self.internal_function(f"tp_{axis}_leaf", leaf(start))
                middle = (start + end) // 2
                left, right = tree(start, middle), tree(middle + 1, end)
                return self.internal_function(f"tp_{axis}", [
                    f"execute if score {score} {self.objective} matches {start}..{middle} run function {self.namespace}/{left}",
                    f"execute if score {score} {self.objective} matches {middle + 1}..{end} run function {self.namespace}/{right}"
                ])

            return tree(low, high)

        if yaw_name and pitch_name:
            if not number_pattern.fullmatch(yaw_name):
                yaw_root = apply_rotation(yaw_name, "yaw", -1800, 1799)
                commands.append(f"function {self.namespace}/{yaw_root}")
            if not number_pattern.fullmatch(pitch_name):
                pitch_root = apply_rotation(pitch_name, "pitch", -900, 900)
                commands.append(f"function {self.namespace}/{pitch_root}")
        commands.append(f"kill {marker}")
        body = self.internal_function("tp", commands)
        return [f"execute as {selector} run function {self.namespace}/{body}"]

    def tellraw(self, text: str, line: int, mode: str = "tell") -> list[str]:
        label = "tell" if mode == "tell" else mode
        if "," not in text:
            raise fail(self.path, line, f"{label}은 '{label} @대상, \"메시지\", 변수' 형식이어야 합니다")
        target, raw_parts = text.split(",", 1)
        target = target.strip()
        if not target:
            raise fail(self.path, line, f"{label} 대상 선택자가 필요합니다")
        command_prefix = f"tellraw {target}" if mode == "tell" else f"titleraw {target} {mode}"
        try:
            tokens = list(tokenize.generate_tokens(io.StringIO(raw_parts).readline))
            normalized_tokens: list[tuple[int, str]] = []
            index = 0
            while index < len(tokens):
                if (index + 2 < len(tokens) and tokens[index].type == tokenize.NAME and
                        tokens[index + 1].type == tokenize.OP and tokens[index + 1].string == ":" and
                        tokens[index + 2].type == tokenize.NUMBER):
                    name, precision = tokens[index].string, tokens[index + 2].string
                    normalized_tokens += [
                        (tokenize.NAME, "fixed"), (tokenize.OP, "("), (tokenize.NAME, name),
                        (tokenize.OP, ","), (tokenize.NUMBER, precision), (tokenize.OP, ")")
                    ]
                    index += 3
                    continue
                normalized_tokens.append((tokens[index].type, tokens[index].string))
                index += 1
            normalized_parts = tokenize.untokenize(normalized_tokens)
            nodes = ast.parse(f"[{normalized_parts}]", mode="eval").body.elts
        except SyntaxError:
            raise fail(self.path, line, f"{label} 항목은 쉼표로 구분하고 문자열은 따옴표로 감싸세요") from None
        parts: list[dict | tuple[str, int]] = []
        commands: list[str] = []
        floats: list[dict[str, object]] = []
        for item in nodes:
            if isinstance(item, ast.Constant) and isinstance(item.value, (str, int, float, bool)):
                parts.append({"text": str(item.value).lower() if isinstance(item.value, bool) else str(item.value)})
            elif isinstance(item, ast.Name) and item.id in self.constants:
                value = self.constants[item.id]
                parts.append({"text": str(value).lower() if isinstance(value, bool) else str(value)})
            elif ((isinstance(item, ast.Name) and item.id in self.variables) or
                  (isinstance(item, ast.Call) and isinstance(item.func, ast.Name) and item.func.id == "fixed")):
                precision = 3
                variable_name = item.id if isinstance(item, ast.Name) else None
                if isinstance(item, ast.Call):
                    if (len(item.args) != 2 or item.keywords or not isinstance(item.args[0], ast.Name) or
                            not isinstance(item.args[1], ast.Constant) or not isinstance(item.args[1].value, int)):
                        raise fail(self.path, line, "float 자릿수는 '변수:0'~'변수:6' 형식이어야 합니다")
                    variable_name = item.args[0].id
                    precision = item.args[1].value
                    if not 0 <= precision <= 6:
                        raise fail(self.path, line, "float 출력 자릿수는 0~6이어야 합니다")
                if variable_name not in self.variables:
                    raise fail(self.path, line, f"정의되지 않은 scoreboard 변수: {variable_name}")
                variable = self.variables[variable_name]
                if isinstance(item, ast.Call) and variable.kind != "float":
                    raise fail(self.path, line, "fixed에는 float 변수만 사용할 수 있습니다")
                if variable.kind != "float":
                    parts.append({"score": {"name": variable.holder, "objective": self.objective}})
                else:
                    if len(floats) >= 5:
                        raise fail(self.path, line, f"{label} 한 문장에는 float 변수를 최대 5개 출력할 수 있습니다")
                    scaled = self._temp()
                    work_e = self._temp()
                    commands += [
                        f"scoreboard players operation {scaled} {self.objective} = {variable.holder} {self.objective}",
                        f"scoreboard players operation {work_e} {self.objective} = {variable.exponent_holder} {self.objective}"
                    ]
                    ten = self._score_constant(commands, 10)
                    one = self._score_constant(commands, 1)
                    target_exponent = -precision
                    lower_range = f"..{target_exponent - 1}"
                    upper_range = f"{target_exponent + 1}.."
                    for _ in range(64):
                        commands += [
                            f"execute if score {work_e} {self.objective} matches {lower_range} run scoreboard players operation {scaled} {self.objective} /= {ten} {self.objective}",
                            f"execute if score {work_e} {self.objective} matches {lower_range} run scoreboard players operation {work_e} {self.objective} += {one} {self.objective}",
                            f"execute if score {work_e} {self.objective} matches {upper_range} run scoreboard players operation {scaled} {self.objective} *= {ten} {self.objective}",
                            f"execute if score {work_e} {self.objective} matches {upper_range} run scoreboard players operation {work_e} {self.objective} -= {one} {self.objective}"
                        ]
                    absolute = self._temp()
                    minus_one = self._score_constant(commands, -1)
                    commands += [
                        f"scoreboard players operation {absolute} {self.objective} = {scaled} {self.objective}",
                        f"execute if score {absolute} {self.objective} matches ..-1 run scoreboard players operation {absolute} {self.objective} *= {minus_one} {self.objective}"
                    ]
                    divisor = self._score_constant(commands, 10 ** precision)
                    whole, remainder = self._temp(), self._temp()
                    commands += [
                        f"scoreboard players operation {whole} {self.objective} = {absolute} {self.objective}",
                        f"scoreboard players operation {whole} {self.objective} /= {divisor} {self.objective}",
                        f"scoreboard players operation {remainder} {self.objective} = {absolute} {self.objective}",
                        f"scoreboard players operation {remainder} {self.objective} %= {divisor} {self.objective}"
                    ]
                    digits: list[str] = []
                    for digit_index in range(precision):
                        digit = self._temp()
                        place = 10 ** (precision - digit_index - 1)
                        commands.append(f"scoreboard players operation {digit} {self.objective} = {remainder} {self.objective}")
                        if place > 1:
                            place_holder = self._score_constant(commands, place)
                            commands.append(f"scoreboard players operation {digit} {self.objective} /= {place_holder} {self.objective}")
                        commands.append(f"scoreboard players operation {digit} {self.objective} %= {ten} {self.objective}")
                        digits.append(digit)
                    floats.append({"scaled": scaled, "whole": whole, "digits": digits})
                    parts.append(("float", len(floats) - 1))
            else:
                name = item.id if isinstance(item, ast.Name) else ast.unparse(item)
                raise fail(self.path, line, f"{label}에서 사용할 수 없는 항목: {name}")
        if not floats:
            message = json.dumps({"rawtext": parts}, ensure_ascii=False, separators=(",", ":"))
            return [f"{command_prefix} {message}"]
        for mask in range(1 << len(floats)):
            rawtext: list[dict] = []
            conditions: list[str] = []
            for index, data in enumerate(floats):
                negative = bool(mask & (1 << index))
                conditions.append(
                    f"if score {data['scaled']} {self.objective} matches {'..-1' if negative else '0..'}")
            for part in parts:
                if isinstance(part, dict):
                    rawtext.append(part)
                    continue
                data = floats[part[1]]
                if mask & (1 << part[1]):
                    rawtext.append({"text": "-"})
                rawtext.append({"score": {"name": data["whole"], "objective": self.objective}})
                if data["digits"]:
                    rawtext.append({"text": "."})
                    rawtext.extend({"score": {"name": digit, "objective": self.objective}} for digit in data["digits"])
            message = json.dumps({"rawtext": rawtext}, ensure_ascii=False, separators=(",", ":"))
            commands.append(f"execute {' '.join(conditions)} run {command_prefix} {message}")
        return commands


def emit(path: Path, nodes: list[Node], namespace: str, variables: dict[str, object] | None = None,
         prefixes: list[str] | None = None, runtime: RuntimeCompiler | None = None,
         sounds: dict[str, str] | None = None) -> list[str]:
    variables = dict(runtime.constants if variables is None and runtime else variables or {})
    prefixes = list(prefixes or [])
    output: list[str] = []

    def branch_context() -> list[str]:
        # function 경계에서 사라지는 좌표/회전 문맥을 분기 본문에서 복원한다.
        # 바깥 as가 선택한 실행자는 @s에 남으므로 selector를 다시 순회하지 않는다.
        return ["as @s" if prefix.startswith("as ") else prefix for prefix in prefixes]

    def condition_context(condition: str) -> tuple[str, list[str]]:
        # `if entity @a positioned ...:`처럼 조건 뒤에 이어 쓴 execute 문맥을
        # 조건과 분리한다. 이 문맥도 function 경계 뒤에서 다시 적용해야 한다.
        match = re.search(
            r"\s+(?=(?:as|at|positioned|rotated|facing|anchored|in|align)\s)",
            condition)
        if not match:
            return condition, []
        return condition[:match.start()].rstrip(), [condition[match.end():].strip()]

    for node_index, node in enumerate(nodes):
        if node.kind == "let":
            match = re.fullmatch(r"([A-Za-z_]\w*)\s*=\s*(.+)", node.value)
            if not match:
                raise fail(path, node.line, "let은 'let 이름 = 값' 형식이어야 합니다")
            variables[match.group(1)] = literal(path, node, match.group(2))
        elif node.kind == "for":
            name, values = range_values(path, node, variables)
            for value in values:
                child_vars = dict(variables)
                child_vars[name] = value
                output.extend(emit(path, node.children, namespace, child_vars, prefixes, runtime, sounds))
        elif node.kind in ("if", "unless"):
            condition = expand_bare(expand(node.value, variables, path, node.line), variables)
            condition, trailing_context = condition_context(condition)
            runtime_condition = runtime and re.match(r"[A-Za-z_]\w*", condition) and re.match(r"[A-Za-z_]\w*", condition).group() in runtime.variables
            if runtime_condition:
                condition_commands, holder, kind = runtime.expression(condition, node.line)
                if kind != "bool":
                    raise fail(path, node.line, "if의 scoreboard 조건식은 bool 결과여야 합니다")
                test = f"score {holder} {runtime.objective} matches 1"
                if prefixes:
                    condition_commands = [f"execute {' '.join(prefixes)} run {command}" for command in condition_commands]
                output.extend(condition_commands)
            else:
                test = condition
            inherited_context = branch_context() + trailing_context
            body = emit(path, node.children, namespace, variables, inherited_context, runtime, sounds)
            body_name = runtime.internal_function(node.kind, body)
            call = f"execute {' '.join(prefixes + [f'{node.kind} {test}'] + trailing_context)} run function {namespace}/{body_name}"
            output.append(call)
            if node.kind == "if" and node.otherwise:
                otherwise = emit(path, node.otherwise, namespace, variables, inherited_context, runtime, sounds)
                else_name = runtime.internal_function("else", otherwise)
                output.append(
                    f"execute {' '.join(prefixes + [f'unless {test}'] + trailing_context)} run function {namespace}/{else_name}")
        elif node.kind == "context":
            context = expand_bare(expand(node.value, variables, path, node.line), variables)
            output.extend(emit(path, node.children, namespace, variables,
                               prefixes + [context], runtime, sounds))
        elif node.kind == "statement":
            if node.value.startswith("tp "):
                if runtime is None:
                    raise fail(path, node.line, "tp를 사용하려면 vars 블록이 필요합니다")
                commands = runtime.teleport(
                    expand_bare(expand(node.value[3:].strip(), variables, path, node.line), variables),
                    node.line)
                if prefixes:
                    commands = [f"execute {' '.join(prefixes)} run {command}" for command in commands]
                output.extend(commands)
                continue
            if node.value.startswith("location "):
                if runtime is None:
                    raise fail(path, node.line, "location을 사용하려면 vars 블록이 필요합니다")
                commands = runtime.location(
                    expand_bare(expand(node.value[9:].strip(), variables, path, node.line), variables),
                    node.line)
                if prefixes:
                    commands = [f"execute {' '.join(prefixes)} run {command}" for command in commands]
                output.extend(commands)
                continue
            if node.value.startswith("rotation "):
                if runtime is None:
                    raise fail(path, node.line, "rotation을 사용하려면 vars 블록이 필요합니다")
                commands = runtime.rotation(
                    expand_bare(expand(node.value[9:].strip(), variables, path, node.line), variables),
                    node.line)
                if prefixes:
                    commands = [f"execute {' '.join(prefixes)} run {command}" for command in commands]
                output.extend(commands)
                continue
            sleep_match = re.fullmatch(r"sleep\(\s*(-?\d+)?\s*\)", node.value)
            if sleep_match:
                if prefixes:
                    raise fail(path, node.line,
                               "sleep은 as/at/if 같은 실행 문맥 안에서 사용할 수 없습니다")
                delay = int(sleep_match.group(1) or 0)
                if not 0 <= delay <= 2_000_000_000:
                    raise fail(path, node.line, "sleep tick은 0~2,000,000,000이어야 합니다")
                if node_index + 1 >= len(nodes):
                    raise fail(path, node.line, "sleep 뒤에 재개할 문장이 필요합니다")
                continuation = emit(path, nodes[node_index + 1:], namespace, variables, [], runtime, sounds)
                continuation_name = runtime.internal_function("sleep", continuation)
                output.append(f"schedule delay add {namespace}/{continuation_name} {delay}t append")
                return output
            tickingarea_match = re.fullmatch(r"await_tickingarea\(\s*(.+?)\s*\)", node.value)
            if tickingarea_match:
                if prefixes:
                    raise fail(path, node.line,
                               "await_tickingarea는 as/at/if 같은 실행 문맥 안에서 사용할 수 없습니다")
                try:
                    area_name = ast.literal_eval(tickingarea_match.group(1))
                except (ValueError, SyntaxError):
                    raise fail(path, node.line,
                               'await_tickingarea는 await_tickingarea("영역이름") 형식이어야 합니다') from None
                if not isinstance(area_name, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+", area_name):
                    raise fail(path, node.line,
                               "ticking area 이름은 영문자, 숫자, _, ., -만 사용할 수 있습니다")
                if node_index + 1 >= len(nodes):
                    raise fail(path, node.line, "await_tickingarea 뒤에 실행할 문장이 필요합니다")
                continuation = emit(path, nodes[node_index + 1:], namespace, variables, [], runtime, sounds)
                continuation_name = runtime.internal_function("tickingarea", continuation)
                output.append(
                    f"schedule on_area_loaded add tickingarea {area_name} "
                    f"{namespace}/{continuation_name}")
                return output
            if runtime is None:
                raise fail(path, node.line, "scoreboard 변수를 사용하려면 vars 블록이 필요합니다")
            commands = runtime.assignment(
                expand_bare(expand(node.value, variables, path, node.line), variables), node.line)
            if prefixes:
                if len(commands) > 1:
                    body_name = runtime.internal_function("context", commands)
                    commands = [f"execute {' '.join(prefixes)} run function {namespace}/{body_name}"]
                else:
                    commands = [f"execute {' '.join(prefixes)} run {commands[0]}"]
            output.extend(commands)
        elif node.kind in ("tell", "title", "subtitle", "actionbar"):
            if runtime is None:
                raise fail(path, node.line, f"{node.kind}을 사용하려면 컴파일러 런타임이 필요합니다")
            message_text = expand(node.value, variables, path, node.line)
            if "," in message_text:
                message_target, message_parts = message_text.split(",", 1)
                message_text = f"{expand_bare(message_target, variables)},{message_parts}"
            commands = runtime.tellraw(message_text, node.line,
                                       "tell" if node.kind == "tell" else node.kind)
            if prefixes:
                if len(commands) > 1:
                    body_name = runtime.internal_function("context", commands)
                    commands = [f"execute {' '.join(prefixes)} run function {namespace}/{body_name}"]
                else:
                    commands = [f"execute {' '.join(prefixes)} run {commands[0]}"]
            output.extend(commands)
        elif node.kind == "play":
            value = expand_bare(expand(node.value, variables, path, node.line), variables)
            pattern = (r"([a-z0-9_./-]+)(?:\s+to\s+(\S+))?(?:\s+at\s+(\S+\s+\S+\s+\S+))?"
                       r"(?:\s+volume\s+([0-9]+(?:\.[0-9]+)?))?"
                       r"(?:\s+pitch\s+([0-9]+(?:\.[0-9]+)?))?"
                       r"(?:\s+minimum\s+([0-9]+(?:\.[0-9]+)?))?")
            match = re.fullmatch(pattern, value)
            if not match:
                raise fail(path, node.line,
                           "play는 'play 이름 [to 대상] [at x y z] [volume 값] [pitch 값] [minimum 값]' 형식이어야 합니다")
            sound_name, target, position, volume, pitch, minimum = match.groups()
            if sounds is None or sound_name not in sounds:
                raise fail(path, node.line, f"sounds 폴더에서 '{sound_name}.ogg'를 찾을 수 없습니다")
            volume_value = float(volume or 1)
            pitch_value = float(pitch or 1)
            minimum_value = float(minimum or 0)
            if not 0 <= volume_value <= 1:
                raise fail(path, node.line, "sound volume은 0~1이어야 합니다")
            if not 0 <= pitch_value <= 256:
                raise fail(path, node.line, "sound pitch는 0~256이어야 합니다")
            if not 0 <= minimum_value <= 1:
                raise fail(path, node.line, "sound minimum은 0~1이어야 합니다")
            command = (f"playsound {sounds[sound_name]} {target or '@a'} {position or '~ ~ ~'} "
                       f"{volume or '1'} {pitch or '1'} {minimum or '0'}")
            if prefixes:
                command = f"execute {' '.join(prefixes)} run {command}"
            output.append(command)
        elif node.kind in ("command", "call"):
            command = expand(node.value, variables, path, node.line)
            if node.kind == "call":
                command = expand_bare(command, variables)
                if not FUNC_NAME.fullmatch(command):
                    raise fail(path, node.line, f"잘못된 함수 이름: {command}")
                command = f"function {namespace}/{command}"
            elif not command.startswith("/"):
                raise fail(path, node.line, "Minecraft 명령은 '/'로 시작해야 합니다")
            else:
                command = command[1:].lstrip()
                if not command:
                    raise fail(path, node.line, "'/' 뒤에 Minecraft 명령이 필요합니다")
            if prefixes:
                command = f"execute {' '.join(prefixes)} run {command}"
            output.append(command)
        elif node.kind == "pass":
            continue
        else:
            raise fail(path, node.line, f"{node.kind} 블록은 여기에서 사용할 수 없습니다")
    return output


def safe_name(value: str, label: str) -> str:
    normalized = re.sub(r"[^a-z0-9_-]+", "_", value.lower()).strip("_")
    if not normalized:
        raise CompileError(f"{label}에 영문 소문자나 숫자가 필요합니다")
    return normalized


def source_context(source: Path) -> tuple[Path, list[Path]]:
    project_root = source if source.is_dir() else source.parent
    if source.is_dir():
        source_files = sorted(path for path in source.rglob("*.bpy") if path.is_file())
    else:
        source_files = [source]
    return project_root, source_files


def read_pack_options(source: Path) -> dict[str, object]:
    project_root, source_files = source_context(source)
    blocks = [node for source_file in source_files for node in parse(source_file) if node.kind == "pack"]
    if len(blocks) > 1:
        block = blocks[1]
        raise fail(block.source or source, block.line, "pack 설정 블록은 프로젝트 전체에 하나만 사용할 수 있습니다")
    if not blocks:
        return {"project_root": project_root}
    block = blocks[0]
    block_path = block.source or source
    allowed = {"name", "description", "icon", "version", "min_engine_version",
               "namespace", "output", "mcpack", "mcaddon", "max_lines"}
    result: dict[str, object] = {"project_root": project_root}
    for option in block.children:
        if option.kind != "statement":
            raise fail(block_path, option.line, "pack 설정에는 옵션 대입만 사용할 수 있습니다")
        match = re.fullmatch(r"([A-Za-z_]\w*)\s*=\s*(.+)", option.value)
        if not match or match.group(1) not in allowed:
            raise fail(block_path, option.line,
                       "pack 옵션은 name, description, icon, version, min_engine_version, "
                       "namespace, output, mcpack, mcaddon, max_lines만 지원합니다")
        key, raw_value = match.groups()
        if key in result:
            raise fail(block_path, option.line, f"중복 pack 옵션: {key}")
        try:
            value = ast.literal_eval(raw_value)
        except (ValueError, SyntaxError):
            if key == "version" and raw_value == "auto":
                value = "auto"
            elif raw_value in ("true", "false", "True", "False"):
                value = raw_value.lower() == "true"
            else:
                raise fail(block_path, option.line, f"pack 옵션 '{key}'의 값이 올바르지 않습니다") from None
        if key in ("name", "description", "icon", "namespace", "output") and not isinstance(value, str):
            raise fail(block_path, option.line, f"pack 옵션 '{key}'은 문자열이어야 합니다")
        if key in ("mcpack", "mcaddon") and not isinstance(value, (bool, str)):
            raise fail(block_path, option.line,
                       f"pack 옵션 '{key}'은 true/false 또는 경로 문자열이어야 합니다")
        if key == "max_lines" and (isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 10_000):
            raise fail(block_path, option.line, "pack 옵션 'max_lines'는 1~10000 정수여야 합니다")
        if key in ("version", "min_engine_version"):
            valid_version = (key == "version" and value == "auto") or (
                             isinstance(value, (list, tuple)) and len(value) == 3
                             and all(not isinstance(part, bool) and isinstance(part, int) and part >= 0
                                     for part in value))
            if not valid_version:
                raise fail(block_path, option.line,
                           f"pack 옵션 '{key}'은 [1, 0, 0] 형태의 음이 아닌 정수 3개"
                           + (" 또는 auto여야 합니다" if key == "version" else "여야 합니다"))
            if value != "auto":
                value = list(value)
        result[key] = value
    return result


def auto_version_state(project_root: Path) -> tuple[Path, dict[str, list[int]]]:
    state_path = project_root / ".bedrockpy" / "versions.json"
    if not state_path.exists():
        return state_path, {}
    try:
        raw = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CompileError(f"자동 버전 기록을 읽을 수 없습니다: {state_path}: {error}") from None
    if not isinstance(raw, dict):
        raise CompileError(f"자동 버전 기록 형식이 올바르지 않습니다: {state_path}")
    versions: dict[str, list[int]] = {}
    for key, value in raw.items():
        if (not isinstance(key, str) or not isinstance(value, list) or len(value) != 3
                or any(isinstance(part, bool) or not isinstance(part, int) or part < 0
                       for part in value)):
            raise CompileError(f"자동 버전 기록 형식이 올바르지 않습니다: {state_path}")
        versions[key] = value
    return state_path, versions


def next_auto_version(project_root: Path, name: str, namespace: str) -> tuple[list[int], Path, dict[str, list[int]], str]:
    state_path, versions = auto_version_state(project_root)
    key = str(uuid.uuid5(uuid.NAMESPACE_URL, f"bedrockpy:{namespace}:{name}:pack"))
    previous = versions.get(key)
    version = [1, 0, 0] if previous is None else [previous[0], previous[1], previous[2] + 1]
    return version, state_path, versions, key


def save_auto_version(state_path: Path, versions: dict[str, list[int]],
                      key: str, version: list[int]) -> None:
    versions[key] = version
    state_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = state_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(versions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(state_path)


def write_pack(source: Path, out: Path, name: str, namespace: str, max_lines: int,
               description: str = "Generated by BedrockPy", icon: Path | None = None,
               version: list[int] | None = None,
               min_engine_version: list[int] | None = None) -> dict:
    if not 1 <= max_lines <= 10_000:
        raise CompileError("--max-lines는 1~10000이어야 합니다")
    project_root, source_files = source_context(source)
    pack_version = version or [1, 0, 0]
    engine_version = min_engine_version or [1, 20, 0]
    if icon is not None:
        if icon.suffix.lower() != ".png":
            raise CompileError(f"pack.icon은 PNG 파일이어야 합니다: {icon}")
        if not icon.is_file():
            raise CompileError(f"pack.icon 파일을 찾을 수 없습니다: {icon}")
    if source.is_dir():
        if not source_files:
            raise CompileError(f"{source}: .bpy 파일을 찾을 수 없습니다")
    sound_root = project_root / "sounds"
    sound_files = sorted(path for path in sound_root.rglob("*")
                         if path.is_file() and path.suffix.lower() == ".ogg") if sound_root.is_dir() else []
    sounds: dict[str, str] = {}
    sound_sources: dict[str, Path] = {}
    for sound_file in sound_files:
        sound_name = sound_file.relative_to(sound_root).with_suffix("").as_posix()
        if not re.fullmatch(r"[a-z0-9_-]+(?:/[a-z0-9_-]+)*", sound_name):
            raise CompileError(
                f"{sound_file}: 사운드 파일 이름에는 영문 소문자, 숫자, '_', '-'와 하위 폴더만 사용할 수 있습니다")
        sounds[sound_name] = f"{namespace}:{sound_name.replace('/', '.')}"
        sound_sources[sound_name] = sound_file
    tree = [node for source_file in source_files for node in parse(source_file)]
    if not tree:
        raise CompileError(f"{source}: 컴파일할 BedrockPy 코드가 없습니다")
    ticks = [n for n in tree if n.kind == "tick"]
    init_blocks = [n for n in tree if n.kind == "init"]
    functions = [n for n in tree if n.kind == "function"]
    var_blocks = [n for n in tree if n.kind == "vars"]
    sound_blocks = [n for n in tree if n.kind == "sound"]
    invalid = [n for n in tree if n.kind not in ("tick", "init", "function", "vars", "sound", "pack")]
    if invalid:
        raise fail(invalid[0].source or source, invalid[0].line,
                   "최상위에는 vars, init, tick, sound 또는 function 블록만 올 수 있습니다")
    sound_options: dict[str, dict[str, object]] = {
        sound_name: {"category": "neutral", "is3D": True} for sound_name in sounds
    }
    configured_sounds: set[str] = set()
    for block in sound_blocks:
        block_path = block.source or source
        sound_name = block.value
        if sound_name not in sounds:
            raise fail(block_path, block.line, f"sounds 폴더에서 '{sound_name}.ogg'를 찾을 수 없습니다")
        if sound_name in configured_sounds:
            raise fail(block_path, block.line, f"중복 사운드 설정: {sound_name}")
        configured_sounds.add(sound_name)
        options = sound_options[sound_name]
        seen_options: set[str] = set()
        for option in block.children:
            if option.kind != "statement":
                raise fail(block_path, option.line, "sound 설정에는 category와 is3D 대입만 사용할 수 있습니다")
            match = re.fullmatch(r"(category|is3D)\s*=\s*(.+)", option.value)
            if not match:
                raise fail(block_path, option.line,
                           "sound 설정은 'category = ui' 또는 'is3D = false' 형식이어야 합니다")
            key, raw_value = match.groups()
            if key in seen_options:
                raise fail(block_path, option.line, f"중복 sound 옵션: {key}")
            seen_options.add(key)
            if key == "category":
                if not re.fullmatch(r"[a-z][a-z0-9_]*", raw_value):
                    raise fail(block_path, option.line, "sound category는 영문 소문자 식별자여야 합니다")
                options[key] = raw_value
            else:
                if raw_value not in ("true", "false", "True", "False"):
                    raise fail(block_path, option.line, "sound is3D는 true 또는 false여야 합니다")
                options[key] = raw_value.lower() == "true"
    declarations = [declaration for block in var_blocks for declaration in block.children]
    runtime = RuntimeCompiler(source, namespace, declarations)
    build_id = uuid.uuid4().int % 2_000_000_000 + 1
    function_specs: list[tuple[Node, str, str | None]] = []
    for function in functions:
        match = re.fullmatch(r"([a-z0-9_./-]+?)(?:\s+when\s+(first|last))?", function.value)
        if not match:
            raise fail(function.source or source, function.line,
                       "함수는 'function 이름:' 또는 'function 이름 when first/last:' 형식이어야 합니다")
        function_specs.append((function, match.group(1), match.group(2)))
        if match.group(1) == "init":
            raise fail(function.source or source, function.line,
                       "'init'은 init: 블록을 수동 실행하는 예약 함수 이름입니다")
    has_lifecycle = any(mode for _, _, mode in function_specs)

    shutil.rmtree(out, ignore_errors=True)
    fn_root = out / "functions" / namespace
    fn_root.mkdir(parents=True)
    tick_commands: list[str] = []
    has_timed_ticks = False
    for block in ticks:
        commands = emit(block.source or source, block.children, namespace,
                        runtime=runtime, sounds=sounds)
        interval_text = block.value or "1"
        if interval_text == "1":
            tick_commands.extend(commands)
            continue
        has_timed_ticks = True
        body_name = runtime.internal_function("tick_every", commands)
        block_path = (block.source or source).resolve()
        digest = uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"bedrockpy:tick-every:{namespace}:{block_path}:{block.line}"
        ).hex[:10]
        holder = f"bpt_{digest}"
        if interval_text.isdigit():
            interval = int(interval_text)
            tick_commands.extend([
                f"scoreboard players add {holder} {runtime.objective} 1",
                f"execute if score {holder} {runtime.objective} matches {interval}.. run function {namespace}/{body_name}",
                f"execute if score {holder} {runtime.objective} matches {interval}.. run scoreboard players set {holder} {runtime.objective} 0",
            ])
        else:
            if interval_text not in runtime.variables:
                raise fail(block.source or source, block.line,
                           f"정의되지 않은 tick 주기 변수: {interval_text}")
            interval_variable = runtime.variables[interval_text]
            if interval_variable.kind != "int":
                raise fail(block.source or source, block.line, "tick 주기 변수는 int여야 합니다")
            trigger = f"{holder}_r"
            tick_commands.extend([
                f"scoreboard players add {holder} {runtime.objective} 1",
                f"scoreboard players set {trigger} {runtime.objective} 0",
                f"execute if score {interval_variable.holder} {runtime.objective} matches 1.. if score {holder} {runtime.objective} >= {interval_variable.holder} {runtime.objective} run scoreboard players set {trigger} {runtime.objective} 1",
                f"execute if score {trigger} {runtime.objective} matches 1 run scoreboard players set {holder} {runtime.objective} 0",
                f"execute if score {interval_variable.holder} {runtime.objective} matches ..0 run scoreboard players set {holder} {runtime.objective} 0",
                f"execute if score {trigger} {runtime.objective} matches 1 run function {namespace}/{body_name}",
            ])
    user_init_commands = [command for block in init_blocks
                          for command in emit(block.source or source, block.children, namespace,
                                              runtime=runtime, sounds=sounds)]
    tick_names: list[str] = []
    for index in range(0, len(tick_commands), max_lines):
        chunk_name = f"tick_{index // max_lines + 1:04d}"
        commands = tick_commands[index:index + max_lines]
        (fn_root / f"{chunk_name}.mcfunction").write_text("\n".join(commands) + "\n", encoding="utf-8")
        tick_names.append(f"{namespace}/{chunk_name}")

    if runtime.variables or init_blocks or has_lifecycle or has_timed_ticks:
        init_name = f"{namespace}/__init"
        init = runtime.init_commands(build_id, user_init_commands,
                                     bool(runtime.variables or init_blocks), has_lifecycle)
        if len(init) > max_lines:
            block = init_blocks[0] if init_blocks else None
            raise fail(block.source if block and block.source else source, block.line if block else 1,
                       f"통합 init 함수가 {len(init)}개 명령으로 제한 {max_lines}개를 넘었습니다")
        (fn_root / "__init.mcfunction").write_text("\n".join(init) + "\n", encoding="utf-8")
        tick_names.insert(0, init_name)

    if runtime.variables or init_blocks:
        manual_init = runtime.manual_init_commands(build_id, user_init_commands)
        if len(manual_init) > max_lines:
            block = init_blocks[0] if init_blocks else None
            raise fail(block.source if block and block.source else source, block.line if block else 1,
                       f"수동 init 함수가 {len(manual_init)}개 명령으로 제한 {max_lines}개를 넘었습니다")
        (fn_root / "init.mcfunction").write_text(
            "\n".join(manual_init) + "\n", encoding="utf-8")

    seen: set[str] = set()
    lifecycle_end: list[str] = []
    automatic_workers: list[str] = []

    def write_automatic_workers(fn_name: str, commands: list[str]) -> list[str]:
        digest = uuid.uuid5(
            uuid.NAMESPACE_URL, f"bedrockpy:automatic-worker:{namespace}:{fn_name}").hex[:10]
        flag = f"bpw_{digest}"
        worker_root = fn_root / "__workers"
        worker_root.mkdir(parents=True, exist_ok=True)
        for index in range(0, len(commands), max_lines):
            worker_name = f"__workers/{digest}_{index // max_lines + 1:04d}"
            guarded = [
                f"execute if score {flag} {runtime.objective} matches 1 run {command}"
                for command in commands[index:index + max_lines]
            ]
            target = fn_root / f"{worker_name}.mcfunction"
            target.write_text("\n".join(guarded) + "\n", encoding="utf-8")
            automatic_workers.append(f"{namespace}/{worker_name}")
        reset_name = f"__workers/{digest}_reset"
        (fn_root / f"{reset_name}.mcfunction").write_text(
            f"execute if score {flag} {runtime.objective} matches 1 run scoreboard players set {flag} {runtime.objective} 0\n",
            encoding="utf-8")
        automatic_workers.append(f"{namespace}/{reset_name}")
        return [f"scoreboard players set {flag} {runtime.objective} 1"]

    for function, fn_name, lifecycle_mode in function_specs:
        if not FUNC_NAME.fullmatch(fn_name) or fn_name.startswith("/") or ".." in fn_name:
            raise fail(function.source or source, function.line, f"잘못된 함수 이름: {fn_name}")
        if fn_name.startswith(("__internal/", "__lifecycle/", "__workers/")) or fn_name == "__init":
            raise fail(function.source or source, function.line, f"'{fn_name}'은 컴파일러가 예약한 함수 이름입니다")
        if fn_name in seen:
            raise fail(function.source or source, function.line, f"중복 함수 이름: {fn_name}")
        seen.add(fn_name)
        commands = emit(function.source or source, function.children, namespace,
                        runtime=runtime, sounds=sounds)
        asynchronous = len(commands) > max_lines
        target = fn_root / f"{fn_name}.mcfunction"
        target.parent.mkdir(parents=True, exist_ok=True)
        if lifecycle_mode:
            digest = uuid.uuid5(uuid.NAMESPACE_URL, f"bedrockpy:lifecycle:{namespace}:{fn_name}").hex[:10]
            holder = f"bpl_{digest}"
            body_name = f"__lifecycle/{digest}_body"
            body_target = fn_root / f"{body_name}.mcfunction"
            body_target.parent.mkdir(parents=True, exist_ok=True)
            body_commands = write_automatic_workers(fn_name, commands) if asynchronous else commands
            body_target.write_text("\n".join(body_commands) + "\n", encoding="utf-8")
            if lifecycle_mode == "first":
                wrapper = [
                    f"execute unless score {holder} {runtime.objective} = bpi_tick {runtime.objective} unless score {holder} {runtime.objective} = bpi_prev {runtime.objective} run function {namespace}/{body_name}",
                    f"scoreboard players operation {holder} {runtime.objective} = bpi_tick {runtime.objective}"
                ]
            else:
                wrapper = [f"scoreboard players operation {holder} {runtime.objective} = bpi_tick {runtime.objective}"]
                lifecycle_end.append(
                    f"execute if score {holder} {runtime.objective} = bpi_prev {runtime.objective} run function {namespace}/{body_name}")
            target.write_text("\n".join(wrapper) + "\n", encoding="utf-8")
        else:
            output_commands = write_automatic_workers(fn_name, commands) if asynchronous else commands
            target.write_text("\n".join(output_commands) + "\n", encoding="utf-8")

    if automatic_workers and not (fn_root / "__init.mcfunction").exists():
        (fn_root / "__init.mcfunction").write_text(
            f"scoreboard objectives add {runtime.objective} dummy\n", encoding="utf-8")
        tick_names.insert(0, f"{namespace}/__init")

    if has_lifecycle:
        lifecycle_root = fn_root / "__lifecycle"
        lifecycle_root.mkdir(parents=True, exist_ok=True)
        begin = [f"scoreboard players add bpi_tick {runtime.objective} 1",
                 f"scoreboard players operation bpi_prev {runtime.objective} = bpi_tick {runtime.objective}",
                 f"scoreboard players operation bpi_prev {runtime.objective} -= bpi_one {runtime.objective}"]
        (lifecycle_root / "begin.mcfunction").write_text("\n".join(begin) + "\n", encoding="utf-8")
        begin_name = f"{namespace}/__lifecycle/begin"
        init_offset = 1 if tick_names and tick_names[0] == f"{namespace}/__init" else 0
        tick_names.insert(init_offset, begin_name)
        if lifecycle_end:
            (lifecycle_root / "end.mcfunction").write_text("\n".join(lifecycle_end) + "\n", encoding="utf-8")
            tick_names.append(f"{namespace}/__lifecycle/end")

    if automatic_workers:
        end_name = f"{namespace}/__lifecycle/end"
        insert_at = tick_names.index(end_name) if end_name in tick_names else len(tick_names)
        tick_names[insert_at:insert_at] = automatic_workers

    def write_internal_file(internal_name: str, commands: list[str]) -> None:
        target = fn_root / f"{internal_name}.mcfunction"
        target.parent.mkdir(parents=True, exist_ok=True)
        if len(commands) <= max_lines:
            target.write_text("\n".join(commands) + "\n", encoding="utf-8")
            return
        if max_lines < 2:
            raise CompileError(
                f"내부 함수 '{internal_name}'를 분할하려면 max_lines가 2 이상이어야 합니다")

        leaf_names: list[str] = []
        for index in range(0, len(commands), max_lines):
            leaf_name = f"{internal_name}__part_{index // max_lines + 1:04d}"
            leaf_target = fn_root / f"{leaf_name}.mcfunction"
            leaf_target.parent.mkdir(parents=True, exist_ok=True)
            leaf_target.write_text(
                "\n".join(commands[index:index + max_lines]) + "\n", encoding="utf-8")
            leaf_names.append(leaf_name)

        current_names = leaf_names
        level = 1
        while len(current_names) > max_lines:
            parent_names: list[str] = []
            for index in range(0, len(current_names), max_lines):
                parent_name = f"{internal_name}__level_{level:02d}_{index // max_lines + 1:04d}"
                parent_target = fn_root / f"{parent_name}.mcfunction"
                parent_target.parent.mkdir(parents=True, exist_ok=True)
                parent_target.write_text(
                    "\n".join(
                        f"function {namespace}/{child}"
                        for child in current_names[index:index + max_lines]
                    ) + "\n",
                    encoding="utf-8")
                parent_names.append(parent_name)
            current_names = parent_names
            level += 1

        target.write_text(
            "\n".join(f"function {namespace}/{child}" for child in current_names) + "\n",
            encoding="utf-8")

    for internal_name, commands in runtime.internal_functions.items():
        write_internal_file(internal_name, commands)

    (out / "functions" / "tick.json").write_text(
        json.dumps({"values": tick_names}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    pack_id = uuid.uuid5(uuid.NAMESPACE_URL, f"bedrockpy:{namespace}:{name}:pack")
    module_id = uuid.uuid5(uuid.NAMESPACE_URL, f"bedrockpy:{namespace}:{name}:module")
    resource_id = uuid.uuid5(uuid.NAMESPACE_URL, f"bedrockpy:{namespace}:{name}:resource-pack")
    manifest = {
        "format_version": 2,
        "header": {
            "name": name,
            "description": description,
            "uuid": str(pack_id),
            "version": pack_version,
            "min_engine_version": engine_version
        },
        "modules": [{"type": "data", "uuid": str(module_id), "version": pack_version}]
    }
    resource_pack: Path | None = None
    if sounds:
        manifest["dependencies"] = [{"uuid": str(resource_id), "version": pack_version}]
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if icon is not None:
        shutil.copy2(icon, out / "pack_icon.png")
    if sounds:
        resource_pack = out.with_name(f"{out.name}_RP")
        shutil.rmtree(resource_pack, ignore_errors=True)
        resource_sound_root = resource_pack / "sounds"
        resource_sound_root.mkdir(parents=True)
        definitions: dict[str, dict] = {}
        for sound_name, event_name in sounds.items():
            source_sound = sound_sources[sound_name]
            target_sound = resource_sound_root / f"{sound_name}.ogg"
            target_sound.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_sound, target_sound)
            options = sound_options[sound_name]
            sound_entry: str | dict[str, object] = f"sounds/{sound_name}"
            if options["is3D"] is not True:
                sound_entry = {"name": f"sounds/{sound_name}", "is3D": options["is3D"]}
            definitions[event_name] = {
                "category": options["category"],
                "sounds": [sound_entry]
            }
        (resource_sound_root / "sound_definitions.json").write_text(
            json.dumps({"format_version": "1.20.20", "sound_definitions": definitions},
                       ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        resource_module_id = uuid.uuid5(uuid.NAMESPACE_URL,
                                        f"bedrockpy:{namespace}:{name}:resource-module")
        resource_manifest = {
            "format_version": 2,
            "header": {
                "name": f"{name} Resources",
                "description": f"{description} Resources",
                "uuid": str(resource_id),
                "version": pack_version,
                "min_engine_version": engine_version
            },
            "modules": [{"type": "resources", "uuid": str(resource_module_id), "version": pack_version}]
        }
        (resource_pack / "manifest.json").write_text(
            json.dumps(resource_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if icon is not None:
            shutil.copy2(icon, resource_pack / "pack_icon.png")
    return {"tick_commands": len(tick_commands), "tick_files": len(tick_names),
            "functions": len(functions), "sounds": len(sounds), "resource_pack": resource_pack}


def make_archive(pack: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for item in sorted(pack.rglob("*")):
            if item.is_file():
                archive.write(item, item.relative_to(pack))


def make_addon(packs: list[Path], target: Path) -> None:
    """Archive one or more complete packs under separate roots in a .mcaddon."""
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for pack in packs:
            for item in sorted(pack.rglob("*")):
                if item.is_file():
                    archive.write(item, Path(pack.name) / item.relative_to(pack))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Python풍 DSL을 Minecraft Bedrock 함수 팩으로 컴파일합니다.")
    parser.add_argument("source", type=Path, help=".bpy 소스 파일 또는 .bpy 파일들이 든 프로젝트 폴더")
    parser.add_argument("-o", "--output", type=Path, help="출력 행동 팩 폴더(pack.output보다 우선)")
    parser.add_argument("--name", help="팩 표시 이름(pack.name보다 우선)")
    parser.add_argument("--namespace", help="함수 네임스페이스 폴더(pack.namespace보다 우선)")
    parser.add_argument("--max-lines", type=int, help="tick 조각당 최대 명령 수(pack.max_lines보다 우선)")
    parser.add_argument("--mcpack", type=Path, help="선택 사항: .mcpack 파일도 생성")
    parser.add_argument("--no-mcpack", action="store_true", help="pack.mcpack 설정을 무시")
    parser.add_argument("--mcaddon", type=Path, help="선택 사항: 행동·리소스 팩을 묶은 .mcaddon 생성")
    parser.add_argument("--no-mcaddon", action="store_true", help="pack.mcaddon 설정을 무시")
    parser.add_argument("--print-config", action="store_true", help="해석된 pack 설정을 JSON으로 출력")
    args = parser.parse_args(argv)
    try:
        source = args.source.resolve()
        options = read_pack_options(source)
        project_root = options["project_root"]
        configured_output = options.get("output")
        output = args.output.resolve() if args.output else (
            (project_root / configured_output).resolve() if configured_output else None)
        name = args.name or options.get("name") or "BedrockPy Pack"
        namespace = safe_name(args.namespace or options.get("namespace") or "bedrockpy", "namespace")
        max_lines = args.max_lines or options.get("max_lines") or 10_000
        description = options.get("description") or "Generated by BedrockPy"
        configured_version = options.get("version") or [1, 0, 0]
        min_engine_version = options.get("min_engine_version") or [1, 20, 0]
        configured_icon = options.get("icon")
        icon = (project_root / configured_icon).resolve() if configured_icon else None
        configured_mcpack = False if args.no_mcpack else options.get("mcpack", False)
        mcpack: Path | None = args.mcpack.resolve() if args.mcpack else None
        if mcpack is None and configured_mcpack:
            if output is None:
                raise CompileError("pack.mcpack을 사용하려면 pack.output도 지정해야 합니다")
            mcpack = ((project_root / configured_mcpack).resolve()
                      if isinstance(configured_mcpack, str) else Path(f"{output}.mcpack"))
        configured_mcaddon = False if args.no_mcaddon else options.get("mcaddon", False)
        mcaddon: Path | None = args.mcaddon.resolve() if args.mcaddon else None
        if mcaddon is None and configured_mcaddon:
            if output is None:
                raise CompileError("pack.mcaddon을 사용하려면 pack.output도 지정해야 합니다")
            mcaddon = ((project_root / configured_mcaddon).resolve()
                       if isinstance(configured_mcaddon, str) else Path(f"{output}.mcaddon"))
        resolved = {
            "name": name, "namespace": namespace, "max_lines": max_lines,
            "description": description, "icon": str(icon) if icon else None,
            "version": configured_version, "min_engine_version": min_engine_version,
            "output": str(output) if output else None,
            "mcpack": str(mcpack) if mcpack else None,
            "mcaddon": str(mcaddon) if mcaddon else None,
            "has_pack_block": any(key != "project_root" for key in options)
        }
        if args.print_config:
            print(json.dumps(resolved, ensure_ascii=False))
            return 0
        if output is None:
            raise CompileError("출력 폴더가 필요합니다. -o 옵션이나 pack.output을 지정하세요")
        auto_version_data: tuple[Path, dict[str, list[int]], str] | None = None
        if configured_version == "auto":
            version, state_path, saved_versions, version_key = next_auto_version(
                project_root, name, namespace)
            auto_version_data = state_path, saved_versions, version_key
        else:
            version = configured_version
        stats = write_pack(source, output, name, namespace, max_lines, description, icon,
                           version, min_engine_version)
        if mcpack:
            make_archive(output, mcpack)
            if stats["resource_pack"]:
                resource_archive = mcpack.with_name(f"{mcpack.stem}_resources.mcpack")
                make_archive(stats["resource_pack"], resource_archive)
        if mcaddon:
            addon_packs = [output]
            if stats["resource_pack"]:
                addon_packs.append(stats["resource_pack"])
            make_addon(addon_packs, mcaddon)
        if auto_version_data:
            state_path, saved_versions, version_key = auto_version_data
            save_auto_version(state_path, saved_versions, version_key, version)
    except (CompileError, OSError) as error:
        print(f"오류: {error}", file=sys.stderr)
        return 1
    sound_summary = f", 커스텀 사운드 {stats['sounds']}개" if stats["sounds"] else ""
    print(f"완료: tick 명령 {stats['tick_commands']}개 → 파일 {stats['tick_files']}개, "
          f"일반 함수 {stats['functions']}개{sound_summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
