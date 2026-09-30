#!/usr/bin/env node
/**
 * Собирает статический хаб для просмотра всех 50 статей силатехники.рф
 * целиком, без сборки и выкладки основного сайта.
 *
 * Это не боевой сайт и не публикация на нём. Все страницы закрыты
 * от поисковиков (noindex): эти же адреса на силатехники.рф уже есть
 * в выдаче, и дубль на GitHub Pages им навредил бы.
 *
 *   node preview/scripts/build_site.mjs
 *   python3 preview/scripts/check_site.py
 *
 * Markdown переводится в HTML тем же конвейером, что и в Astro
 * (@astrojs/markdown-remark), — текст здесь размечен так же, как на сайте.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownProcessor, parseFrontmatter } from '@astrojs/markdown-remark';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const ARTICLES = path.join(ROOT, 'src', 'content', 'articles');
const IMAGES = path.join(ROOT, 'public', 'images', 'articles');
const OUT = path.join(ROOT, 'preview', 'docs');

const PRODUCTION = 'https://www.xn--80akhcalds5an8a.xn--p1ai';
const HUMAN = 'силатехники.рф';

// Те же разделы и подписи, что в src/lib/articles.ts
const GROUPS = [
  { key: 'price', label: 'Цена и выбор' },
  { key: 'tech', label: 'Технология' },
  { key: 'problem', label: 'Проблемы и ремонт' },
  { key: 'geo', label: 'Города' },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function humanDate(d) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function page({ title, description, depth, content }) {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="${up}assets/style.css">
</head>
<body>
<div class="preview-banner">Предпросмотр статей — не боевой сайт. Статьи живут на <a href="${PRODUCTION}/articles">${HUMAN}</a>.</div>
<header class="site-header">
<div class="wrap">
<a class="home-link" href="${up}index.html">Силатехники — статьи о скважинах (предпросмотр)</a>
</div>
</header>
<main class="wrap">
${content}
</main>
<footer class="site-footer wrap">
<p>Отдельный хаб для просмотра всех статей целиком. Это не боевой сайт и не публикация на нём.</p>
</footer>
</body>
</html>
`;
}

/** Ссылки статьи: другие статьи — внутри хаба, картинки — из хаба, остальное — на боевой сайт. */
function rewriteLinks(html, slugs) {
  return html
    .replace(/href="\/articles\/([a-z0-9-]+)(#[^"]*)?"/g, (m, slug, hash = '') =>
      slugs.has(slug) ? `href="../${slug}/index.html${hash}"` : `href="${PRODUCTION}/articles/${slug}${hash}"`)
    .replace(/(src|href)="\/images\/articles\/([^"]+)"/g, '$1="../../assets/images/$2"')
    .replace(/href="(\/[^"]*)"/g, (m, p) => `href="${PRODUCTION}${p}" target="_blank" rel="noopener"`);
}

function makeToc(html) {
  const heads = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)];
  if (heads.length < 4) return { html, toc: '' };
  let i = 0;
  const items = [];
  const out = html.replace(/<h2[^>]*>(.*?)<\/h2>/g, (m, text) => {
    const id = `sec-${i++}`;
    items.push(`<li><a href="#${id}">${text.replace(/<[^>]+>/g, '')}</a></li>`);
    return `<h2 id="${id}">${text}</h2>`;
  });
  return {
    html: out,
    toc: `<nav class="toc" aria-label="Оглавление"><p class="toc-title">Оглавление</p><ol>${items.join('')}</ol></nav>`,
  };
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'assets', 'images'), { recursive: true });

  const md = await createMarkdownProcessor();
  const files = fs.readdirSync(ARTICLES).filter((f) => f.endsWith('.md'));
  const slugs = new Set(files.map((f) => f.replace(/\.md$/, '')));
  const usedImages = new Set();
  const articles = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const { frontmatter: meta, content: body } = parseFrontmatter(fs.readFileSync(path.join(ARTICLES, file), 'utf8'));
    const images = [...body.matchAll(/!\[[^\]]*\]\(\/images\/articles\/([^)\s]+)/g)].map((m) => m[1]);
    images.forEach((i) => usedImages.add(i));

    let { code: html } = await md.render(body);
    html = rewriteLinks(html, slugs);
    const { html: withIds, toc } = makeToc(html);

    const group = GROUPS.find((g) => g.key === meta.group);
    const content =
      `<p class="breadcrumb"><a href="../../index.html">Все статьи</a> · ` +
      `<a href="../../index.html#group-${group.key}">${group.label}</a></p>` +
      `<article><h1>${esc(meta.title)}</h1>` +
      `<p class="lede">${esc(meta.description)}</p>` +
      `<p class="breadcrumb">Дата на сайте: ${humanDate(meta.updated ?? meta.published)} — ` +
      `<a href="${PRODUCTION}/articles/${slug}">${HUMAN}/articles/${slug}</a></p>` +
      toc + withIds + '</article>';

    const dir = path.join(OUT, 'articles', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), page({
      title: `${meta.title} — Силатехники (предпросмотр)`,
      description: meta.description,
      depth: 2,
      content,
    }));

    articles.push({ slug, ...meta, images });
  }

  // --- главная хаба: по разделам, свежие вперёд, как на /articles ---
  articles.sort((a, b) => new Date(b.published) - new Date(a.published));
  let content = '<h1>Статьи силатехники.рф — предпросмотр</h1>' +
    `<p class="lede">${articles.length} статей о бурении и обслуживании скважин, сгруппированы по разделам. ` +
    'Отдельный хаб для просмотра всех текстов целиком — не боевой сайт и не индексируется поисковиками.</p>' +
    '<nav class="quicknav" aria-label="Разделы"><p class="quicknav-title">Разделы</p><ul class="quicknav-list">' +
    GROUPS.map((g) => `<li><a href="#group-${g.key}">${g.label}</a></li>`).join('') +
    '</ul></nav>';

  for (const g of GROUPS) {
    const items = articles.filter((a) => a.group === g.key);
    content += `<section class="cluster" id="group-${g.key}"><h2>${g.label} <span class="desc">· ${items.length}</span></h2><ul class="article-list">`;
    for (const a of items) {
      const thumb = a.images[0]
        ? `<a class="thumb-link" href="articles/${a.slug}/index.html"><img class="thumb" src="assets/images/${a.images[0]}" alt="" loading="lazy" decoding="async"></a>`
        : '';
      content += `<li>${thumb}<div class="article-list-text"><a href="articles/${a.slug}/index.html">${esc(a.title)}</a>` +
        `<p class="desc">${esc(a.description)}</p>` +
        `<p class="desc">Дата на сайте: ${humanDate(a.updated ?? a.published)}</p></div></li>`;
    }
    content += '</ul></section>';
  }

  fs.writeFileSync(path.join(OUT, 'index.html'), page({
    title: 'Статьи силатехники.рф — предпросмотр',
    description: `Хаб для просмотра ${articles.length} статей целиком.`,
    depth: 0,
    content,
  }));

  // --- статика ---
  for (const name of usedImages) fs.copyFileSync(path.join(IMAGES, name), path.join(OUT, 'assets', 'images', name));
  fs.copyFileSync(path.join(HERE, 'style.css'), path.join(OUT, 'assets', 'style.css'));
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  fs.writeFileSync(path.join(OUT, '404.html'), page({
    title: 'Страница не найдена — Силатехники (предпросмотр)',
    description: 'Страница не найдена.',
    depth: 0,
    content: '<h1>Страница не найдена</h1><p><a href="index.html">Вернуться к списку статей</a></p>',
  }));

  console.log(`Собрано статей: ${articles.length}, картинок: ${usedImages.size} → ${path.relative(ROOT, OUT)}/`);
}

main();
