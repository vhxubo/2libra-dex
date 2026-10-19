#!/usr/bin/env python3
"""从 top/*.html 徽章卡片中提取通用数据，合并去重后输出 badges.json。"""
import json
import re
from html import unescape
from pathlib import Path

SRC_DIR = Path(__file__).parent / "top"
OUT_FILE = Path(__file__).parent / "badges.json"

CARD_RE = re.compile(r'<div class="hover-3d">')
NAME_RE = re.compile(r'<h4 class="text-base font-bold mb-2 line-clamp-1">(.*?)</h4>')
ICON_RE = re.compile(r'<img alt="[^"]*"[^>]*src="([^"]+)"')
RATE_RE = re.compile(r'获得率：</span><span class="text-xs text-base-content/50">([\d.]+)%</span>')
CONDITION_RE = re.compile(
    r'class="text-xs text-base-content/70 line-clamp-2 leading-relaxed tooltip emoji mx-2 min-h-10" data-tip="([^"]*)"'
)
ATTR_LABEL_RE = re.compile(r'<div class="text-xs font-semibold text-base-content/80">(描述|佩戴属性)</div>')
ATTR_RE = re.compile(r'<p class="text-xs text-base-content/60 line-clamp-2 leading-relaxed">(.*?)</p>')
LEVEL_RE = re.compile(r'徽章级别 (T\d)')


def clean(s: str) -> str:
    return unescape(s).strip()


def parse_card(card: str, owner: str, warnings: list):
    name = NAME_RE.search(card)
    icon = ICON_RE.search(card)
    rate = RATE_RE.search(card)
    cond = CONDITION_RE.search(card)
    label = ATTR_LABEL_RE.search(card)
    attr = ATTR_RE.search(card)
    level = LEVEL_RE.search(card)

    missing = [f for f, m in [("name", name), ("icon", icon), ("rate", rate),
                              ("condition", cond), ("attrLabel", label),
                              ("attr", attr), ("level", level)] if not m]
    if missing:
        warnings.append(f"[{owner}] 卡片缺少字段 {missing}，片段: {card[:120]}...")
        return None

    return {
        "id": Path(icon.group(1)).stem,
        "icon": icon.group(1),
        "name": clean(name.group(1)),
        "level": level.group(1),
        "rate": float(rate.group(1)),
        "condition": clean(cond.group(1)),
        "attrType": label.group(1),
        "attr": clean(attr.group(1)),
        "owner": owner,
    }


def main():
    records = []
    warnings = []
    for f in sorted(SRC_DIR.glob("*.html")):
        owner = f.stem
        cards = CARD_RE.split(f.read_text(encoding="utf-8"))[1:]
        for card in cards:
            rec = parse_card(card, owner, warnings)
            if rec:
                records.append(rec)

    # 同一徽章跨用户合并
    badges: dict[str, dict] = {}
    for rec in records:
        b = badges.setdefault(rec["id"], {
            "id": rec["id"], "name": rec["name"], "icon": rec["icon"],
            "level": rec["level"], "rate": rec["rate"],
            "condition": rec["condition"], "attrType": rec["attrType"],
            "attr": rec["attr"],
        })
        for key in ("name", "level", "rate", "condition", "attrType", "attr"):
            if b[key] != rec[key]:
                warnings.append(f"徽章 {rec['id']} 字段 {key} 不一致: {b[key]!r} vs {rec[key]!r} ({rec['owner']})")

    level_order = {"T0": 0, "T1": 1, "T2": 2, "T3": 3}
    badge_list = sorted(badges.values(),
                        key=lambda b: (level_order.get(b["level"], 9), b["rate"], b["id"]))

    result = {
        "meta": {
            "badgeCount": len(badge_list),
        },
        "badges": badge_list,
    }
    OUT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"唯一徽章 {len(badge_list)} 个（共 {len(records)} 条记录）")
    print(f"输出: {OUT_FILE}")
    if warnings:
        print(f"\n警告 {len(warnings)} 条:")
        for w in warnings:
            print(" -", w)


if __name__ == "__main__":
    main()
