function isDevServiceLine(line) {
  const t = String(line?.articleType || '').toLowerCase();
  return t === 'developpement' || t === 'service';
}

module.exports = isDevServiceLine;
