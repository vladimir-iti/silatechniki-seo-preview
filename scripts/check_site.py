#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка собранного preview-сайта: битые ссылки, изображения, noindex, утечки служебного."""

import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BUILD = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs"))
ARTICLES = os.path.join(ROOT, "src", "content", "articles")

# Следы конвейера генерации, которые читателю ничего не говорят.
# Это предупреждение, а не ошибка: править надо исходник статьи.
SERVICE_PHRASES = re.compile(r"базе источников|в источниках (?:статьи|нет)|источники статьи", re.I)


def all_html_files():
    for root, _, files in os.walk(BUILD):
        for f in files:
            if f.endswith(".html"):
                yield os.path.join(root, f)


def check():
    problems = []
    warnings = []
    checked_links = 0
    checked_images = 0
    total_pages = 0

    for path in all_html_files():
        total_pages += 1
        html = open(path, encoding="utf-8").read()
        page_dir = os.path.dirname(path)
        rel = os.path.relpath(path, BUILD)

        if 'name="robots"' not in html or "noindex" not in html:
            problems.append("MISSING noindex ROBOTS META: %s" % rel)

        text = re.sub(r"<[^>]+>", " ", html)
        for m in SERVICE_PHRASES.finditer(text):
            warnings.append("SERVICE PHRASE: %s -> %r" % (rel, text[max(0, m.start() - 60):m.end() + 20].strip()))

        for href in re.findall(r'href="([^"]+)"', html):
            if href.startswith(("http://", "https://", "mailto:", "tel:", "#")):
                continue
            checked_links += 1
            target = os.path.normpath(os.path.join(page_dir, href.split("#")[0]))
            if not os.path.isfile(target):
                problems.append("BROKEN LINK: %s -> %s" % (rel, href))

        for src in re.findall(r'src="([^"]+)"', html):
            if src.startswith(("http://", "https://")):
                continue
            checked_images += 1
            target = os.path.normpath(os.path.join(page_dir, src))
            if not os.path.isfile(target):
                problems.append("BROKEN IMAGE: %s -> %s" % (rel, src))

    # утечка служебных файлов конвейера в собранный результат
    forbidden_names = ("strategy.json", "pipeline.json", "content-strategy")
    for root, dirs, files in os.walk(BUILD):
        for name in files + dirs:
            if name in forbidden_names:
                problems.append("PIPELINE FILE LEAKED: %s" % os.path.join(root, name))

    # каждая статья сайта должна иметь страницу, и ни одной лишней
    slugs = set(f[:-3] for f in os.listdir(ARTICLES) if f.endswith(".md"))
    built = set(os.listdir(os.path.join(BUILD, "articles")))
    for slug in sorted(slugs - built):
        problems.append("ARTICLE MISSING FROM BUILD: %s" % slug)
    for slug in sorted(built - slugs):
        problems.append("UNEXPECTED ARTICLE IN BUILD: %s" % slug)

    print("Pages checked: %d" % total_pages)
    print("Links checked: %d" % checked_links)
    print("Images checked: %d" % checked_images)
    print()
    if warnings:
        print("WARNINGS: %d" % len(warnings))
        for w in warnings:
            print(" -", w)
        print()
    if problems:
        print("PROBLEMS FOUND: %d" % len(problems))
        for p in problems:
            print(" -", p)
        return 1
    print("No problems found.")
    return 0


if __name__ == "__main__":
    sys.exit(check())
