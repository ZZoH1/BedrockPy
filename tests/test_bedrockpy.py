import json
import math
import re
import tempfile
import unittest
import zipfile
from unittest import mock
from pathlib import Path

import bedrockpy


class CompilerTests(unittest.TestCase):
    @staticmethod
    def run_scoreboard(commands):
        scores = {}
        def matches(value, interval):
            if ".." not in interval:
                return value == int(interval)
            low, high = interval.split("..", 1)
            return (not low or value >= int(low)) and (not high or value <= int(high))
        def execute(command):
            if command.startswith("scoreboard objectives add "):
                return
            if command.startswith("execute "):
                conditions, nested = command[8:].split(" run ", 1)
                while conditions:
                    match = re.match(r"(if|unless) score (\S+) \S+ matches (\S+)(?: |$)", conditions)
                    if match:
                        passed = matches(scores.get(match.group(2), 0), match.group(3))
                    else:
                        match = re.match(r"(if|unless) score (\S+) \S+ (<=|>=|!=|=|<|>) (\S+) \S+(?: |$)", conditions)
                        if not match:
                            raise AssertionError(f"unsupported condition: {conditions}")
                        left, right = scores.get(match.group(2), 0), scores.get(match.group(4), 0)
                        passed = {"=": left == right, "!=": left != right, "<": left < right,
                                  "<=": left <= right, ">": left > right, ">=": left >= right}[match.group(3)]
                    if match.group(1) == "unless": passed = not passed
                    if not passed: return
                    conditions = conditions[match.end():]
                execute(nested)
                return
            match = re.fullmatch(r"scoreboard players (set|add|remove) (\S+) \S+ (-?\d+)", command)
            if match:
                action, holder, raw = match.groups(); value = int(raw)
                scores[holder] = value if action == "set" else scores.get(holder, 0) + (value if action == "add" else -value)
                return
            match = re.fullmatch(r"scoreboard players operation (\S+) \S+ (=|\+=|-=|\*=|/=|%=) (\S+) \S+", command)
            if match:
                target, operator, source = match.groups(); left, right = scores.get(target, 0), scores.get(source, 0)
                if operator == "=": result = right
                elif operator == "+=": result = left + right
                elif operator == "-=": result = left - right
                elif operator == "*=": result = left * right
                elif operator == "/=": result = int(left / right) if right else 0
                else: result = left - int(left / right) * right if right else 0
                if not -2_147_483_648 <= result <= 2_147_483_647:
                    raise AssertionError(f"scoreboard overflow: {result}")
                scores[target] = result
                return
            raise AssertionError(f"unsupported command: {command}")
        for command in commands: execute(command)
        return scores

    @staticmethod
    def decimal_value(runtime, holder, scores):
        return scores[holder] * (10.0 ** scores[runtime.float_exponents[holder]])

    def evaluate(self, expression):
        runtime = bedrockpy.RuntimeCompiler(Path("test.bpy"), "test", [])
        commands, holder, kind = runtime.expression(expression, 1)
        return runtime, self.run_scoreboard(commands), holder, kind

    def test_eight_digit_decimal_float_runtime(self):
        runtime = bedrockpy.RuntimeCompiler(Path("test.bpy"), "test", [])
        cases = {"1.5 * 1.1": 1.65, "99999999.0 * 99999999.0": 9999999800000001.0,
                 "1.0 / 3.0": 1 / 3, "6.5 % 2.0": 0.5, "-2.5 * 4.0": -10.0}
        for expression, expected in cases.items():
            with self.subTest(expression=expression):
                commands, holder, kind = runtime.expression(expression, 1)
                scores = self.run_scoreboard(commands)
                actual = self.decimal_value(runtime, holder, scores)
                self.assertEqual("float", kind)
                self.assertLessEqual(abs(actual - expected), max(abs(expected) * 2e-8, 1e-8))

    def test_decimal_math_runtime_and_command_budget(self):
        cases = {"sqrt(2.0)": (math.sqrt(2), 1e-7), "sin(0.5)": (math.sin(0.5), 1e-7),
                 "log(2.0)": (math.log(2), 1e-7), "log(100.0, 10.0)": (2.0, 1e-7)}
        for expression, (expected, tolerance) in cases.items():
            with self.subTest(expression=expression):
                runtime = bedrockpy.RuntimeCompiler(Path("test.bpy"), "test", [])
                commands, holder, _ = runtime.expression(expression, 1)
                scores = self.run_scoreboard(commands)
                self.assertLess(abs(self.decimal_value(runtime, holder, scores) - expected), tolerance)
                self.assertLessEqual(len(commands), 10_000)

    def test_rotation_stores_pitch_and_yaw_with_binary_search(self):
        temp, root, _ = self.compile("""vars:
  int pitch = 0
  float yaw = 0.0
tick:
  rotation @a[tag=tracked] -> pitch, yaw
""")
        self.addCleanup(temp.cleanup)
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        self.assertEqual(2, len(tick))
        self.assertTrue(all(line.startswith("execute as @a[tag=tracked] run function test/__internal/rotation_")
                            for line in tick))
        rotation_files = list((root / "pack/functions/test/__internal").glob("rotation_*.mcfunction"))
        self.assertEqual(1080, len(rotation_files))
        branch_text = "\n".join(path.read_text() for path in rotation_files if "_leaf_" not in path.name)
        self.assertIn("@s[rxm=", branch_text)
        self.assertIn("@s[rym=", branch_text)
        yaw_leaf = next(path.read_text() for path in rotation_files
                        if "rotation_yaw_leaf" in path.name and "rym=" in path.read_text())
        self.assertIn("scoreboard players set bpv_yaw_e", yaw_leaf)

    def test_rotation_rejects_bool_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text("""vars:
  bool pitch = false
  int yaw = 0
tick:
  rotation @s -> pitch, yaw
""", encoding="utf-8")
            with self.assertRaisesRegex(bedrockpy.CompileError, "int 또는 float"):
                bedrockpy.write_pack(source, root / "pack", "Test", "test", 10_000)

    def test_location_uses_hidden_high_altitude_armor_stand(self):
        temp, root, _ = self.compile("""vars:
  float x = 0.0
  float y = 0.0
  float z = 0.0
tick:
  location @a[tag=tracked] -> x, y, z
""")
        self.addCleanup(temp.cleanup)
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text().strip()
        self.assertRegex(tick, r"execute as @a\[tag=tracked\] at @s run function test/__internal/location_\d+")
        internals = root / "pack/functions/test/__internal"
        location_files = list(internals.glob("location*.mcfunction"))
        self.assertEqual(768, len(location_files))
        body = max(location_files, key=lambda path: len(path.read_text().splitlines())).read_text()
        self.assertIn("summon armor_stand 0 1000 0", body)
        self.assertIn("invisibility 999999 0 true", body)
        self.assertIn("as @e[type=armor_stand,tag=bpi_location_marker,c=1] at @s run tp @s", body)
        self.assertIn("30000000", body)
        self.assertIn("y=-512", "\n".join(path.read_text() for path in location_files))
        self.assertIn("kill @e[type=armor_stand,tag=bpi_location_marker,c=1]", body)
        self.assertLessEqual(len(body.splitlines()), 10_000)

    def test_location_rejects_bool_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text("""vars:
  int x = 0
  bool y = false
  int z = 0
tick:
  location @s -> x, y, z
""", encoding="utf-8")
            with self.assertRaisesRegex(bedrockpy.CompileError, "int 또는 float"):
                bedrockpy.write_pack(source, root / "pack", "Test", "test", 10_000)

    def test_location_int_xz_uses_center_coordinate_boundary(self):
        temp, root, _ = self.compile("""vars:
  int x = 0
  int y = 0
  int z = 0
tick:
  location @s -> x, y, z
""")
        self.addCleanup(temp.cleanup)
        body = max((root / "pack/functions/test/__internal").glob("location*.mcfunction"),
                   key=lambda path: len(path.read_text().splitlines())).read_text()
        self.assertNotIn("positioned ~ ~-1200 ~-35000000", body)
        self.assertNotIn("positioned ~-35000000 ~-1200 ~ ", body)
        self.assertIn("positioned ~1.3 ~-1200 ~-35000000", body)
        self.assertIn("positioned ~-35000000 ~-1200 ~1.3", body)
        self.assertNotIn("scoreboard players remove", body)

    def test_tp_uses_scoreboard_location_and_rotation_variables(self):
        temp, root, _ = self.compile("""vars:
  float x = 0.0
  int y = 64
  float z = 0.0
  float ry = 0.0
  float rx = 0.0
tick:
  tp @a[tag=tracked] -> x, y, z, ry, rx
""")
        self.addCleanup(temp.cleanup)
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text().strip()
        self.assertRegex(tick, r"execute as @a\[tag=tracked\] run function test/__internal/tp_\d+")
        internals = root / "pack/functions/test/__internal"
        body = next(path.read_text() for path in internals.glob("tp_*.mcfunction")
                    if "bpi_tp_marker" in path.read_text())
        self.assertIn("summon armor_stand 0 1000 0", body)
        self.assertIn("invisibility 999999 0 true", body)
        self.assertIn("execute at @e[type=armor_stand,tag=bpi_tp_marker,c=1] run tp @s ~-0.5 ~ ~-0.5", body)
        self.assertIn("kill @e[type=armor_stand,tag=bpi_tp_marker,c=1]", body)
        self.assertLessEqual(len(body.splitlines()), 10_000)
        rotation_text = "\n".join(path.read_text() for path in internals.glob("tp_*.mcfunction"))
        self.assertIn("tp @s ~ ~ ~ 0 ~", rotation_text)
        self.assertIn("tp @s ~ ~ ~ ~ 0", rotation_text)

    def test_tp_rejects_bool_variable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text("""vars:
  int x = 0
  bool y = false
  int z = 0
tick:
  tp @s -> x, y, z
""", encoding="utf-8")
            with self.assertRaisesRegex(bedrockpy.CompileError, "int 또는 float"):
                bedrockpy.write_pack(source, root / "pack", "Test", "test", 10_000)

    def compile(self, source: str, max_lines: int = 10_000):
        temp = tempfile.TemporaryDirectory()
        root = Path(temp.name)
        src = root / "main.bpy"
        src.write_text(source, encoding="utf-8")
        stats = bedrockpy.write_pack(src, root / "pack", "Test", "test", max_lines)
        return temp, root, stats

    def test_global_let_string_is_substituted_at_compile_time(self):
        temp, root, _ = self.compile('''vars:
  let greeting = "안녕하세요"
  let block = "diamond_block"
  let target = "@a"
  int count = 1
  float x = 0.0
  float y = 64.0
  float z = 0.0
tick:
  tell target, greeting, " ", count
  tp target -> x, y, z
  /say {greeting}
  /say target
function place:
  /setblock ~ ~ ~ {block}
''')
        self.addCleanup(temp.cleanup)
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text(encoding="utf-8")
        function = (root / "pack/functions/test/place.mcfunction").read_text(encoding="utf-8")
        self.assertIn('"text":"안녕하세요"', tick)
        self.assertIn("tellraw @a", tick)
        self.assertIn("execute as @a run function test/__internal/tp_", tick)
        self.assertIn("say 안녕하세요", tick)
        self.assertIn("say target", tick)
        self.assertIn("setblock ~ ~ ~ diamond_block", function)
        self.assertNotIn("bpv_greeting", tick)

    def test_loop_condition_and_context(self):
        temp, root, stats = self.compile("""tick:
  for i in range(3):
    if entity @a[tag=t{i}]:
      as @a:
        /say {i}
""")
        self.addCleanup(temp.cleanup)
        lines = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        self.assertEqual(3, stats["tick_commands"])
        self.assertEqual("execute if entity @a[tag=t0] run function test/__internal/if_0001", lines[0])
        internal = (root / "pack/functions/test/__internal/if_0001.mcfunction").read_text().splitlines()
        self.assertEqual(["execute as @a run say 0"], internal)

    def test_if_call_contains_outer_coordinate_context(self):
        temp, root, _ = self.compile("""tick:
  at @a:
    positioned ~1 ~2 ~3:
      rotated ~10 ~20:
        if entity @s:
          /setblock ~ ~ ~ stone
""")
        self.addCleanup(temp.cleanup)
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        self.assertEqual(1, len(tick))
        self.assertRegex(
            tick[0],
            r"^execute at @a positioned ~1 ~2 ~3 rotated ~10 ~20 if entity @s run function test/__internal/if_\d+$")
        body_name = tick[0].rsplit(" ", 1)[1].split("/", 1)[1]
        body = (root / f"pack/functions/test/{body_name}.mcfunction").read_text().splitlines()
        self.assertEqual([
            "execute at @a positioned ~1 ~2 ~3 rotated ~10 ~20 run setblock ~ ~ ~ stone"
        ], body)

    def test_nested_if_reapplies_positioned_context_without_reselecting_executor(self):
        temp, root, _ = self.compile("""tick:
  as @e[tag=stone_block]:
    at @s positioned ~ ~-1000 ~:
      if entity @a[tag=target,r=1]:
        if block ~-1 ~ ~ air:
          /setblock ~-1 ~ ~ stone
""")
        self.addCleanup(temp.cleanup)
        internal = root / "pack/functions/test/__internal"
        bodies = [path.read_text() for path in internal.glob("if_*.mcfunction")]
        self.assertTrue(any(
            "execute as @s at @s positioned ~ ~-1000 ~ if block ~-1 ~ ~ air run function" in body
            for body in bodies))
        self.assertTrue(any(
            "execute as @s at @s positioned ~ ~-1000 ~ run setblock ~-1 ~ ~ stone" in body
            for body in bodies))
        self.assertFalse(any("execute as @e[tag=stone_block]" in body for body in bodies))

    def test_context_after_if_condition_is_reapplied_inside_nested_branches(self):
        temp, root, _ = self.compile("""tick:
  as @e[tag=stone_block]:
    at @s positioned ~ ~-1000 ~:
      positioned ~0.5 ~ ~:
        if entity @a[tag=target,r=0.5] positioned ~-0.5 ~ ~:
          if block ~-1 ~ ~ air:
            /setblock ~-1 ~ ~ stone
""")
        self.addCleanup(temp.cleanup)
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text()
        self.assertIn(
            "if entity @a[tag=target,r=0.5] positioned ~-0.5 ~ ~ run function", tick)
        bodies = [path.read_text() for path in
                  (root / "pack/functions/test/__internal").glob("if_*.mcfunction")]
        restored = "as @s at @s positioned ~ ~-1000 ~ positioned ~0.5 ~ ~ positioned ~-0.5 ~ ~"
        self.assertTrue(any(f"execute {restored} if block ~-1 ~ ~ air run function" in body
                            for body in bodies))
        self.assertTrue(any(f"execute {restored} run setblock ~-1 ~ ~ stone" in body
                            for body in bodies))

    def test_context_wraps_multicommand_float_operation_atomically(self):
        temp, root, stats = self.compile("""vars:
  float value = 1.5
tick:
  positioned 0 0 0 as @a[r=2]:
    value *= 1.1
""")
        self.addCleanup(temp.cleanup)
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        self.assertEqual(1, stats["tick_commands"])
        self.assertEqual(
            ["execute positioned 0 0 0 as @a[r=2] run function test/__internal/context_0001"], tick)
        context = (root / "pack/functions/test/__internal/context_0001.mcfunction").read_text()
        self.assertIn("scoreboard players operation bpv_value bp_test =", context)
        self.assertNotIn("execute positioned 0 0 0 as", context)

    def test_tick_is_split_and_registered_in_order(self):
        commands = "\n".join(f"  /say {i}" for i in range(7))
        temp, root, stats = self.compile(f"tick:\n{commands}\n", max_lines=3)
        self.addCleanup(temp.cleanup)
        tick = json.loads((root / "pack/functions/tick.json").read_text())
        self.assertEqual(["test/tick_0001", "test/tick_0002", "test/tick_0003"], tick["values"])
        self.assertEqual(3, stats["tick_files"])

    def test_periodic_tick_uses_independent_counters_and_internal_functions(self):
        temp, root, stats = self.compile("""tick:
  /say always
tick every 5:
  /say five
tick every 20:
  /say twenty
""")
        self.addCleanup(temp.cleanup)
        tick_json = json.loads((root / "pack/functions/tick.json").read_text())["values"]
        self.assertEqual("test/__init", tick_json[0])
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        self.assertEqual("say always", tick[0])
        self.assertEqual(7, len(tick))
        holders = [line.split()[3] for line in tick if line.startswith("scoreboard players add ")]
        self.assertEqual(2, len(set(holders)))
        self.assertTrue(any("matches 5.. run function test/__internal/tick_every_" in line for line in tick))
        self.assertTrue(any("matches 20.. run function test/__internal/tick_every_" in line for line in tick))
        bodies = sorted((root / "pack/functions/test/__internal").glob("tick_every_*.mcfunction"))
        self.assertEqual(["say five\n", "say twenty\n"], [path.read_text() for path in bodies])
        self.assertIn("scoreboard objectives add bp_test dummy",
                      (root / "pack/functions/test/__init.mcfunction").read_text())
        self.assertEqual(7, stats["tick_commands"])

    def test_periodic_tick_rejects_zero_interval(self):
        with self.assertRaisesRegex(bedrockpy.CompileError, "1~2,000,000,000"):
            self.compile("""tick every 0:
  /say never
""")

    def test_periodic_tick_accepts_dynamic_int_interval(self):
        temp, root, stats = self.compile("""vars:
  int rate = 20
tick every rate:
  /say dynamic
""")
        self.addCleanup(temp.cleanup)
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        self.assertEqual(6, len(tick))
        self.assertTrue(any("if score bpv_rate bp_test matches 1.." in line and
                            ">= bpv_rate bp_test" in line for line in tick))
        self.assertTrue(any("if score bpv_rate bp_test matches ..0" in line for line in tick))
        self.assertEqual(6, stats["tick_commands"])

    def test_periodic_tick_rejects_non_int_interval_variable(self):
        with self.assertRaisesRegex(bedrockpy.CompileError, "int여야"):
            self.compile("""vars:
  float rate = 20.0
tick every rate:
  /say invalid
""")

    def test_pass_allows_empty_function_without_commands(self):
        temp, root, stats = self.compile("""function placeholder:
  pass
""")
        self.addCleanup(temp.cleanup)
        self.assertEqual("\n", (root / "pack/functions/test/placeholder.mcfunction").read_text())
        self.assertEqual(1, stats["functions"])

    def test_pass_works_inside_conditional_block(self):
        temp, root, _ = self.compile("""tick:
  if entity @a:
    pass
  else:
    /say nobody
""")
        self.addCleanup(temp.cleanup)
        internal = root / "pack/functions/test/__internal"
        bodies = [path.read_text() for path in internal.glob("*.mcfunction")]
        self.assertIn("\n", bodies)
        self.assertIn("say nobody\n", bodies)

    def test_tp_accepts_numeric_constants_mixed_with_variables(self):
        temp, root, _ = self.compile("""vars:
  float y = 64.5
tick:
  tp @s -> 10.5, y, -3
""")
        self.addCleanup(temp.cleanup)
        body = next((root / "pack/functions/test/__internal").glob("tp_*.mcfunction")).read_text()
        self.assertIn("run tp @s 10.5 ~ -3", body)
        self.assertNotIn(" 105", body)
        self.assertNotIn(" -30", body)

    def test_tp_rejects_numeric_constant_outside_scoreboard_range(self):
        with self.assertRaisesRegex(bedrockpy.CompileError, "scoreboard 범위"):
            self.compile("""tick:
  tp @s -> 300000000, 0, 0
""")

    def test_tp_with_only_constants_compiles_to_native_command(self):
        temp, root, stats = self.compile("""tick:
  tp @a -> 10.5, 64, -3, 90, 0
""")
        self.addCleanup(temp.cleanup)
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        self.assertEqual(["tp @a 10.5 64 -3 90 0"], tick)
        self.assertEqual(1, stats["tick_commands"])
        internal = root / "pack/functions/test/__internal"
        self.assertFalse(internal.exists())

    def test_mixed_tp_puts_constant_rotation_in_native_command(self):
        temp, root, _ = self.compile("""vars:
  float x = 1.0
  float rx = 2.0
tick:
  tp @s -> x, 64, -3, 90, rx
""")
        self.addCleanup(temp.cleanup)
        bodies = [path.read_text() for path in
                  (root / "pack/functions/test/__internal").glob("tp_*.mcfunction")]
        wrapper = next(body for body in bodies if "bpi_tp_marker" in body and "summon armor_stand" in body)
        self.assertIn("run tp @s ~-0.5 64 -3 90 ~", wrapper)

    def test_large_regular_function_becomes_automatic_tick_workers(self):
        commands = "\n".join(f"  /say {i}" for i in range(4))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text(f"function too_big:\n{commands}\n", encoding="utf-8")
            bedrockpy.write_pack(source, root / "pack", "Test", "test", 3)
            wrapper = (root / "pack/functions/test/too_big.mcfunction").read_text()
            self.assertRegex(wrapper, r"scoreboard players set bpw_[0-9a-f]+ bp_test 1")
            tick = json.loads((root / "pack/functions/tick.json").read_text())["values"]
            self.assertEqual("test/__init", tick[0])
            self.assertIn("scoreboard objectives add bp_test dummy",
                          (root / "pack/functions/test/__init.mcfunction").read_text())
            workers = [name for name in tick if "/__workers/" in name]
            self.assertEqual(3, len(workers))
            bodies = [(root / f"pack/functions/{name}.mcfunction").read_text().splitlines()
                      for name in workers]
            self.assertEqual([3, 1, 1], [len(body) for body in bodies])
            self.assertTrue(all(line.startswith("execute if score bpw_")
                                for body in bodies for line in body))

    def test_real_ten_thousand_boundary(self):
        temp, root, stats = self.compile("""tick:
  for i in range(10001):
    /say {i}
""")
        self.addCleanup(temp.cleanup)
        tick = json.loads((root / "pack/functions/tick.json").read_text())
        first = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        second = (root / "pack/functions/test/tick_0002.mcfunction").read_text().splitlines()
        self.assertEqual(2, stats["tick_files"])
        self.assertEqual(10_000, len(first))
        self.assertEqual(["say 10000"], second)
        self.assertEqual(["test/tick_0001", "test/tick_0002"], tick["values"])

    def test_else_uses_inverse_condition(self):
        temp, root, _ = self.compile("""tick:
  if entity @a[tag=ready]:
    /say ready
  else:
    /say waiting
""")
        self.addCleanup(temp.cleanup)
        lines = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        self.assertEqual([
            "execute if entity @a[tag=ready] run function test/__internal/if_0001",
            "execute unless entity @a[tag=ready] run function test/__internal/else_0002"
        ], lines)
        self.assertEqual("say ready\n", (root / "pack/functions/test/__internal/if_0001.mcfunction").read_text())
        self.assertEqual("say waiting\n", (root / "pack/functions/test/__internal/else_0002.mcfunction").read_text())

    def test_minecraft_command_requires_slash(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text("tick:\n  say slash required\n", encoding="utf-8")
            with self.assertRaisesRegex(bedrockpy.CompileError, "'/'"):
                bedrockpy.write_pack(source, root / "pack", "Test", "test", 10_000)

    def test_typed_scoreboard_variables_and_float_scaling(self):
        temp, root, _ = self.compile("""vars:
  int count = 0
  float speed = 1.5
  float distance = 150000.0
  float tiny = 0.001
  bool enabled = true
  bool visible = false
tick:
  count += 1
  speed = speed * 2.0
  enabled = count >= 10
  visible = enabled and not false
  if enabled:
    /say enabled
  else:
    /say disabled
""")
        self.addCleanup(temp.cleanup)
        init = (root / "pack/functions/test/__init.mcfunction").read_text()
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text()
        registration = json.loads((root / "pack/functions/tick.json").read_text())
        self.assertIn("bpv_speed bp_test 15000000", init)
        self.assertIn("bpv_speed_e bp_test -7", init)
        self.assertIn("bpv_distance bp_test 15000000", init)
        self.assertIn("bpv_distance_e bp_test -2", init)
        self.assertIn("bpv_tiny bp_test 10000000", init)
        self.assertIn("bpv_tiny_e bp_test -10", init)
        self.assertIn("bpv_enabled bp_test 1", init)
        self.assertIn("scoreboard players operation bpv_count bp_test +=", tick)
        self.assertIn("scoreboard players operation bpv_speed bp_test =", tick)
        self.assertIn("execute if score", tick)
        self.assertEqual("test/__init", registration["values"][0])

    def test_cmd_keyword_was_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text("tick:\n  cmd /say no\n", encoding="utf-8")
            with self.assertRaises(bedrockpy.CompileError):
                bedrockpy.write_pack(source, root / "pack", "Test", "test", 10_000)

    def test_tell_builds_rawtext_with_variables(self):
        temp, root, _ = self.compile("""vars:
  int count = 7
  float speed = 1.5
  bool enabled = true
tick:
  tell @a, "점수: ", count, " 속도: ", speed, " 활성: ", enabled
""")
        self.addCleanup(temp.cleanup)
        lines = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        tellraws = [line for line in lines if " run tellraw @a " in line]
        self.assertEqual(2, len(tellraws))
        self.assertTrue(any("matches ..-1" in line for line in tellraws))
        self.assertTrue(any("matches 0.." in line for line in tellraws))
        raw = json.loads(tellraws[0].split(" run tellraw @a ", 1)[1])
        self.assertEqual({"text": "점수: "}, raw["rawtext"][0])
        self.assertIn({"score": {"name": "bpv_count", "objective": "bp_test"}}, raw["rawtext"])
        self.assertIn({"text": "."}, raw["rawtext"])
        decimal_point = raw["rawtext"].index({"text": "."})
        self.assertTrue(all("score" in part for part in raw["rawtext"][decimal_point + 1:decimal_point + 4]))

    def test_tell_float_precision_can_be_selected(self):
        temp, root, _ = self.compile("""vars:
  float speed = 1.5
tick:
  tell @a, speed:1
  tell @a, speed:0
""")
        self.addCleanup(temp.cleanup)
        lines = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        positive = [line for line in lines if "matches 0.." in line and "run tellraw" in line]
        self.assertEqual(2, len(positive))
        one_digit = json.loads(positive[0].split(" run tellraw @a ", 1)[1])["rawtext"]
        integer = json.loads(positive[1].split(" run tellraw @a ", 1)[1])["rawtext"]
        dot = one_digit.index({"text": "."})
        self.assertEqual(1, len(one_digit[dot + 1:]))
        self.assertNotIn({"text": "."}, integer)

    def test_title_subtitle_and_actionbar_support_variables(self):
        temp, root, _ = self.compile("""vars:
  int score = 7
  float speed = 1.5
  bool enabled = true
function hud:
  title @s, "게임 시작"
  subtitle @s, "점수: ", score, " / 활성: ", enabled
  actionbar @s, "속도: ", speed:2
""")
        self.addCleanup(temp.cleanup)
        lines = (root / "pack/functions/test/hud.mcfunction").read_text(encoding="utf-8").splitlines()
        self.assertIn('titleraw @s title {"rawtext":[{"text":"게임 시작"}]}', lines)
        subtitle = next(line for line in lines if "titleraw @s subtitle" in line)
        self.assertIn('{"name":"bpv_score","objective":"bp_test"}', subtitle)
        actionbar_lines = [line for line in lines if "titleraw @s actionbar" in line]
        self.assertTrue(actionbar_lines)
        self.assertTrue(any('\"text\":\".\"' in line for line in actionbar_lines))

    def test_math_builtins_compile_below_function_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = Path(__file__).resolve().parents[1] / "examples" / "math.bpy"
            bedrockpy.write_pack(source, root / "pack", "Math", "math", 10_000)
            names = ["absolute_demo", "power_demo", "sqrt_demo", "root_demo", "sin_demo",
                     "cos_demo", "tan_demo", "natural_log_demo", "base10_log_demo"]
            for name in names:
                lines = (root / f"pack/functions/math/{name}.mcfunction").read_text().splitlines()
                self.assertGreater(len(lines), 0)
                self.assertLessEqual(len(lines), 10_000)

    def test_max_and_min_support_multiple_int_values(self):
        runtime, scores, maximum, maximum_kind = self.evaluate("max(-3, 7, 2)")
        self.assertEqual("int", maximum_kind)
        self.assertEqual(7, scores[maximum])
        runtime, scores, minimum, minimum_kind = self.evaluate("min(-3, 7, 2)")
        self.assertEqual("int", minimum_kind)
        self.assertEqual(-3, scores[minimum])

    def test_max_and_min_support_mixed_float_values(self):
        runtime, scores, maximum, maximum_kind = self.evaluate("max(-3, 1.25, 1)")
        self.assertEqual("float", maximum_kind)
        self.assertAlmostEqual(1.25, self.decimal_value(runtime, maximum, scores), places=7)
        runtime, scores, minimum, minimum_kind = self.evaluate("min(2.5, -4, 1.2)")
        self.assertEqual("float", minimum_kind)
        self.assertAlmostEqual(-4.0, self.decimal_value(runtime, minimum, scores), places=7)

    def test_max_and_min_require_two_numeric_arguments(self):
        with self.assertRaisesRegex(bedrockpy.CompileError, "두 개 이상"):
            self.evaluate("max(1)")
        with self.assertRaisesRegex(bedrockpy.CompileError, "int 또는 float"):
            self.evaluate("min(true, 1)")

    def test_init_merges_variable_reset_and_user_commands_per_build(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text("""vars:
  int progress = 5
init:
  /say initialize build
tick:
  /say ticking
""", encoding="utf-8")
            fake_uuid = mock.Mock(int=123456)
            with mock.patch("bedrockpy.uuid.uuid4", return_value=fake_uuid):
                bedrockpy.write_pack(source, root / "pack", "First", "first", 10_000)
            init = (root / "pack/functions/first/__init.mcfunction").read_text().splitlines()
            tick = json.loads((root / "pack/functions/tick.json").read_text())
            build_id = 123456 % 2_000_000_000 + 1
            reset_index = init.index(
                f"execute unless score bpi_build bp_first matches {build_id} run scoreboard players set bpv_progress bp_first 5")
            body_index = init.index(
                f"execute unless score bpi_build bp_first matches {build_id} run say initialize build")
            save_index = init.index(
                f"execute unless score bpi_build bp_first matches {build_id} run scoreboard players set bpi_build bp_first {build_id}")
            self.assertLess(reset_index, body_index)
            self.assertLess(body_index, save_index)
            self.assertFalse((root / "pack/functions/first/__first.mcfunction").exists())
            self.assertEqual("first/__init", tick["values"][0])
            manual = (root / "pack/functions/first/init.mcfunction").read_text().splitlines()
            self.assertEqual([
                "scoreboard players set bpv_progress bp_first 5",
                "say initialize build",
                f"scoreboard players set bpi_build bp_first {build_id}",
            ], manual)

    def test_call_init_calls_public_manual_init_function(self):
        temp, root, _ = self.compile("""vars:
  int value = 1
tick:
  call init
""")
        self.addCleanup(temp.cleanup)
        tick = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        self.assertEqual(["function test/init"], tick)
        self.assertTrue((root / "pack/functions/test/init.mcfunction").exists())

    def test_function_cannot_use_reserved_init_name(self):
        with self.assertRaisesRegex(bedrockpy.CompileError, "예약 함수 이름"):
            self.compile("""function init:
  /say conflict
""")

    def test_function_first_and_last_tick_edges(self):
        temp, root, _ = self.compile("""tick:
  call pulse_start
function pulse_start when first:
  /say started
function pulse_end when last:
  /say stopped
""")
        self.addCleanup(temp.cleanup)
        tick = json.loads((root / "pack/functions/tick.json").read_text())["values"]
        self.assertEqual("test/__init", tick[0])
        self.assertEqual("test/__lifecycle/begin", tick[1])
        self.assertEqual("test/__lifecycle/end", tick[-1])
        first_wrapper = (root / "pack/functions/test/pulse_start.mcfunction").read_text()
        last_wrapper = (root / "pack/functions/test/pulse_end.mcfunction").read_text()
        end = (root / "pack/functions/test/__lifecycle/end.mcfunction").read_text()
        self.assertIn("unless score", first_wrapper)
        self.assertIn("bpi_tick", first_wrapper)
        self.assertNotIn("function test/__lifecycle", last_wrapper)
        self.assertIn("if score", end)
        self.assertIn("run function test/__lifecycle/", end)

    def test_sleep_splits_function_into_scheduled_continuations(self):
        temp, root, _ = self.compile("""function sequence:
  /say start
  sleep(20)
  /say after one second
  sleep(40)
  /say after three seconds
""")
        self.addCleanup(temp.cleanup)
        main = (root / "pack/functions/test/sequence.mcfunction").read_text().splitlines()
        internals = sorted((root / "pack/functions/test/__internal").glob("sleep_*.mcfunction"))
        self.assertEqual("say start", main[0])
        self.assertRegex(main[1], r"schedule delay add test/__internal/sleep_\d+ 20t append")
        self.assertEqual(2, len(internals))
        contents = [item.read_text() for item in internals]
        self.assertTrue(any("40t append" in content for content in contents))
        self.assertTrue(any("say after three seconds" in content for content in contents))

    def test_sleep_zero_schedules_immediate_continuation(self):
        temp, root, _ = self.compile("""function sequence:
  /say before
  sleep(0)
  /say after
""")
        self.addCleanup(temp.cleanup)
        main = (root / "pack/functions/test/sequence.mcfunction").read_text().splitlines()
        self.assertEqual("say before", main[0])
        self.assertRegex(main[1], r"schedule delay add test/__internal/sleep_\d+ 0t append")
        continuation = next((root / "pack/functions/test/__internal").glob("sleep_*.mcfunction"))
        self.assertEqual(["say after"], continuation.read_text().splitlines())

    def test_empty_sleep_defaults_to_zero_ticks(self):
        temp, root, _ = self.compile("""function sequence:
  /say before
  sleep()
  /say after
""")
        self.addCleanup(temp.cleanup)
        main = (root / "pack/functions/test/sequence.mcfunction").read_text().splitlines()
        self.assertRegex(main[1], r"schedule delay add test/__internal/sleep_\d+ 0t append")

    def test_inline_and_multiline_comments(self):
        temp, root, stats = self.compile('''"""
팩 전체 설명입니다.
여러 줄이어도 명령으로 생성되지 않습니다.
"""
tick:
  /say "#은 문자열입니다"  # 명령 뒤 주석
  \'\'\'두 번째 형태의
  여러 줄 주석\'\'\'
  /say done # 마지막 주석
''')
        self.addCleanup(temp.cleanup)
        lines = (root / "pack/functions/test/tick_0001.mcfunction").read_text().splitlines()
        self.assertEqual(2, stats["tick_commands"])
        self.assertEqual(['say "#은 문자열입니다"', "say done"], lines)

    def test_unclosed_multiline_comment_is_an_error(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text('tick:\n  /say before\n  """ never closes\n', encoding="utf-8")
            with self.assertRaisesRegex(bedrockpy.CompileError, "닫히지 않은 여러 줄 주석"):
                bedrockpy.write_pack(source, root / "pack", "Test", "test", 10_000)

    def test_directory_sources_merge_into_one_pack(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            (source / "features").mkdir(parents=True)
            (source / "01_vars.bpy").write_text("""vars:
  int score = 0
init:
  /say variables initialized
""", encoding="utf-8")
            (source / "02_tick.bpy").write_text("""tick:
  score += 1
""", encoding="utf-8")
            (source / "features/combat.bpy").write_text("""tick:
  call combat/update
function combat/update:
  /say combat
""", encoding="utf-8")
            bedrockpy.write_pack(source, root / "pack", "Project", "project", 10_000)
            tick_commands = (root / "pack/functions/project/tick_0001.mcfunction").read_text()
            init = (root / "pack/functions/project/__init.mcfunction").read_text()
            self.assertIn("bpv_score bp_project", tick_commands)
            self.assertIn("function project/combat/update", tick_commands)
            self.assertIn("variables initialized", init)
            self.assertTrue((root / "pack/functions/project/combat/update.mcfunction").exists())

    def test_duplicate_function_across_files_reports_second_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            source.mkdir()
            (source / "a.bpy").write_text("function same:\n  /say a\n", encoding="utf-8")
            second = source / "b.bpy"
            second.write_text("function same:\n  /say b\n", encoding="utf-8")
            with self.assertRaisesRegex(bedrockpy.CompileError, re.escape(str(second))):
                bedrockpy.write_pack(source, root / "pack", "Project", "project", 10_000)

    def test_custom_sound_creates_linked_resource_pack_and_playsound(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            (source / "sounds/ui").mkdir(parents=True)
            (source / "sounds/ui/click.ogg").write_bytes(b"OggS-test")
            (source / "main.bpy").write_text("""function click:
  play ui/click to @s at ~ ~1 ~ volume 0.7 pitch 1.2 minimum 0.1
""", encoding="utf-8")
            pack = root / "ClickBP"
            stats = bedrockpy.write_pack(source, pack, "Click", "click", 10_000)
            command = (pack / "functions/click/click.mcfunction").read_text(encoding="utf-8")
            self.assertEqual(
                "playsound click:ui.click @s ~ ~1 ~ 0.7 1.2 0.1\n", command)
            resource = root / "ClickBP_RP"
            self.assertEqual(resource, stats["resource_pack"])
            self.assertEqual(b"OggS-test", (resource / "sounds/ui/click.ogg").read_bytes())
            definitions = json.loads(
                (resource / "sounds/sound_definitions.json").read_text(encoding="utf-8"))
            self.assertEqual(["sounds/ui/click"],
                             definitions["sound_definitions"]["click:ui.click"]["sounds"])
            behavior_manifest = json.loads((pack / "manifest.json").read_text(encoding="utf-8"))
            resource_manifest = json.loads((resource / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(resource_manifest["header"]["uuid"],
                             behavior_manifest["dependencies"][0]["uuid"])

    def test_play_reports_missing_sound_asset(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text("function test:\n  play missing\n", encoding="utf-8")
            with self.assertRaisesRegex(bedrockpy.CompileError, "missing\\.ogg"):
                bedrockpy.write_pack(source, root / "pack", "Test", "test", 10_000)

    def test_mcpack_build_also_archives_sound_resource_pack(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            (source / "sounds").mkdir(parents=True)
            (source / "sounds/chime.ogg").write_bytes(b"OggS-test")
            (source / "main.bpy").write_text(
                "function chime:\n  play chime\n", encoding="utf-8")
            archive = root / "Sound.mcpack"
            result = bedrockpy.main([
                str(source), "-o", str(root / "SoundBP"), "--name", "Sound",
                "--namespace", "sound", "--mcpack", str(archive)
            ])
            self.assertEqual(0, result)
            self.assertTrue(archive.exists())
            resource_archive = root / "Sound_resources.mcpack"
            self.assertTrue(resource_archive.exists())
            with __import__("zipfile").ZipFile(resource_archive) as package:
                self.assertIn("sounds/chime.ogg", package.namelist())

    def test_mcaddon_contains_behavior_and_sound_resource_packs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            (source / "sounds").mkdir(parents=True)
            (source / "sounds/chime.ogg").write_bytes(b"OggS-test")
            (source / "main.bpy").write_text(
                "function chime:\n  play chime\n", encoding="utf-8")
            addon = root / "Sound.mcaddon"
            result = bedrockpy.main([
                str(source), "-o", str(root / "SoundBP"), "--name", "Sound",
                "--namespace", "sound", "--mcaddon", str(addon)
            ])
            self.assertEqual(0, result)
            with zipfile.ZipFile(addon) as package:
                names = package.namelist()
                self.assertIn("SoundBP/manifest.json", names)
                self.assertIn("SoundBP/functions/sound/chime.mcfunction", names)
                self.assertIn("SoundBP_RP/manifest.json", names)
                self.assertIn("SoundBP_RP/sounds/chime.ogg", names)

    def test_pack_mcaddon_true_uses_output_name_and_print_config(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            source.mkdir()
            (source / "main.bpy").write_text("""pack:
  output = "build/TestBP"
  mcaddon = true
tick:
  /say addon
""", encoding="utf-8")
            with mock.patch("builtins.print") as printed:
                self.assertEqual(0, bedrockpy.main([str(source), "--print-config"]))
            config = json.loads(printed.call_args.args[0])
            self.assertEqual((root / "src/build/TestBP.mcaddon").resolve(),
                             Path(config["mcaddon"]))
            self.assertEqual(0, bedrockpy.main([str(source)]))
            self.assertTrue((source / "build/TestBP.mcaddon").exists())

    def test_sound_category_and_is3d_can_be_configured(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            (source / "sounds/ui").mkdir(parents=True)
            (source / "sounds/ui/click.ogg").write_bytes(b"OggS-test")
            (source / "main.bpy").write_text("""sound ui/click:
  category = ui
  is3D = false

function click:
  play ui/click to @s
""", encoding="utf-8")
            bedrockpy.write_pack(source, root / "pack", "UI", "ui_test", 10_000)
            definitions = json.loads(
                (root / "pack_RP/sounds/sound_definitions.json").read_text(encoding="utf-8"))
            definition = definitions["sound_definitions"]["ui_test:ui.click"]
            self.assertEqual("ui", definition["category"])
            self.assertEqual(
                [{"name": "sounds/ui/click", "is3D": False}], definition["sounds"])

    def test_duplicate_sound_configuration_is_rejected_across_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            (source / "sounds").mkdir(parents=True)
            (source / "sounds/click.ogg").write_bytes(b"OggS-test")
            (source / "a.bpy").write_text(
                "sound click:\n  category = ui\n", encoding="utf-8")
            second = source / "b.bpy"
            second.write_text("sound click:\n  is3D = false\n", encoding="utf-8")
            with self.assertRaisesRegex(bedrockpy.CompileError, re.escape(str(second))):
                bedrockpy.write_pack(source, root / "pack", "UI", "ui_test", 10_000)

    def test_pack_block_controls_cli_output_and_mcpack(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "project"
            source.mkdir()
            (source / "pack.png").write_bytes(
                b"\x89PNG\r\n\x1a\n")
            (source / "main.bpy").write_text("""pack:
  name = "Configured Pack"
  description = "Configured description"
  icon = "pack.png"
  version = [2, 3, 4]
  min_engine_version = [1, 21, 0]
  namespace = "configured"
  output = "build/ConfiguredBP"
  mcpack = "build/Configured.mcpack"
  max_lines = 2

tick:
  /say one
  /say two
  /say three
""", encoding="utf-8")
            self.assertEqual(0, bedrockpy.main([str(source)]))
            pack = source / "build/ConfiguredBP"
            self.assertTrue((pack / "functions/configured/tick_0001.mcfunction").exists())
            self.assertTrue((pack / "functions/configured/tick_0002.mcfunction").exists())
            self.assertTrue((source / "build/Configured.mcpack").exists())
            manifest = json.loads((pack / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual("Configured Pack", manifest["header"]["name"])
            self.assertEqual("Configured description", manifest["header"]["description"])
            self.assertEqual([2, 3, 4], manifest["header"]["version"])
            self.assertEqual([1, 21, 0], manifest["header"]["min_engine_version"])
            self.assertEqual((source / "pack.png").read_bytes(),
                             (pack / "pack_icon.png").read_bytes())
            with zipfile.ZipFile(source / "build/Configured.mcpack") as archive:
                self.assertIn("pack_icon.png", archive.namelist())

    def test_pack_icon_must_exist_and_be_png(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text("""pack:
  output = "build/TestBP"
  icon = "missing.jpg"
tick:
  /say test
""", encoding="utf-8")
            stderr = __import__("io").StringIO()
            with mock.patch("sys.stderr", stderr):
                self.assertEqual(1, bedrockpy.main([str(source)]))
            self.assertIn("PNG", stderr.getvalue())

    def test_print_config_returns_resolved_project_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text("""pack:
  output = "build/TestBP"
  mcpack = true
tick:
  /say test
""", encoding="utf-8")
            stdout = __import__("io").StringIO()
            with mock.patch("sys.stdout", stdout):
                self.assertEqual(0, bedrockpy.main([str(source), "--print-config"]))
            config = json.loads(stdout.getvalue())
            self.assertEqual((root / "build/TestBP").resolve(), Path(config["output"]))
            self.assertEqual((root / "build/TestBP.mcpack").resolve(), Path(config["mcpack"]))
            self.assertTrue(config["has_pack_block"])

    def test_auto_version_increments_only_after_successful_build(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "main.bpy"
            source.write_text('''pack:
  name = "Auto Pack"
  namespace = "auto_pack"
  version = auto
  output = "build/AutoBP"
  mcpack = "build/Auto.mcpack"
tick:
  /say auto
''', encoding="utf-8")
            stdout = __import__("io").StringIO()
            with mock.patch("sys.stdout", stdout):
                self.assertEqual(0, bedrockpy.main([str(source), "--print-config"]))
            self.assertEqual("auto", json.loads(stdout.getvalue())["version"])
            self.assertFalse((root / ".bedrockpy/versions.json").exists())

            self.assertEqual(0, bedrockpy.main([str(source)]))
            manifest_path = root / "build/AutoBP/manifest.json"
            first = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual([1, 0, 0], first["header"]["version"])

            self.assertEqual(0, bedrockpy.main([str(source)]))
            second = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual([1, 0, 1], second["header"]["version"])
            saved = json.loads((root / ".bedrockpy/versions.json").read_text(encoding="utf-8"))
            self.assertIn([1, 0, 1], saved.values())


if __name__ == "__main__":
    unittest.main()
