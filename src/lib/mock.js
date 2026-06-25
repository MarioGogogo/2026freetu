// 本地开发用的 mock 数据，仅用于在 next dev 下预览 UI。
// 通过环境变量 USE_MOCK_DATA=1 启用；设为空则返回空数据，便于预览"无数据"状态。
// 线上(edge runtime)不会执行到这里。

const hasData = process.env.USE_MOCK_DATA !== 'empty';

const imgPool = [
  'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400',
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400',
  'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400',
  'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400',
];

function buildList(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    url: `/file/mock-${i + 1}.png`,
    referer: i % 2 === 0 ? 'https://t.me/somechannel' : '直接访问',
    ip: `101.${i % 200}.${(i * 7) % 250}.${(i * 13) % 250}`,
    rating: [0, 1, 2, 3][i % 4],
    total: (i + 1) * 3,
    time: `2026年6月${(i % 28) + 1}日 ${i % 2 === 0 ? '14:30:00' : '09:15:00'}`,
  }));
}

function buildLog(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    url: `/file/mock-${(i % 4) + 1}.png`,
    referer: i % 3 === 0 ? 'https://t.me/somechannel' : '直接访问',
    ip: `101.${i % 200}.${(i * 5) % 250}.${(i * 11) % 250}`,
    time: `2026年6月${(i % 28) + 1}日 ${i % 2 === 0 ? '14:30:00' : '09:15:00'}`,
    rating: [0, 1, 2, 3][i % 4],
    total: ((i % 4) + 1) * 3,
  }));
}

// list 总共 23 条，log 总共 23 条，方便测试分页
const ALL_LIST = buildList(23);
const ALL_LOG = buildLog(23);

export function mockList(page, query) {
  let rows = ALL_LIST;
  if (query) rows = ALL_LIST.filter(r => r.url.includes(query));
  const total = rows.length;
  const start = page * 10;
  return { data: rows.slice(start, start + 10), total };
}

export function mockLog(page, query) {
  let rows = ALL_LOG;
  if (query) rows = ALL_LOG.filter(r => r.url.includes(query));
  const total = rows.length;
  const start = page * 10;
  return { data: rows.slice(start, start + 10), total };
}

export function mockEnabled() {
  return process.env.USE_MOCK_DATA !== undefined;
}

export function mockTotal() {
  return hasData ? ALL_LIST.length : 0;
}
