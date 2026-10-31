import { haversine, formatDistance } from './distance.js';

const $ = (id) => document.getElementById(id);
const places = { origin: null, destination: null };
let searching = false;
let calculating = false;
let revision = 0;
let lastRequest = 0;
const config = fetch('./config.json', { cache: 'no-cache' }).then((r) => {
  if (!r.ok) throw new Error('설정을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
  return r.json();
});
// A failed configuration request is handled when the user searches or calculates.
config.catch(() => {});
const status = (message) => { $('status').textContent = message; };
function update() {
  revision++;
  $('result').hidden = true;
  $('empty').hidden = false;
  $('calculate').disabled = !places.origin || !places.destination || calculating || searching;
}
function selectPlace(key, place) {
  places[key] = place;
  $(key).value = place.name || place.display_name.split(',')[0];
  $(`${key}-selection`).textContent = place.display_name;
  $(`${key}-selection`).classList.add('chosen');
  $(`${key}-results`).replaceChildren();
  update();
  status(places.origin && places.destination ? '준비됐어요. 거리 계산하기를 눌러 주세요.' : '나머지 장소도 검색해서 선택해 주세요.');
}
async function request(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(18000), referrerPolicy: 'strict-origin-when-cross-origin' });
  if (!response.ok) {
    if (response.status === 429) throw new Error('검색 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    throw new Error('외부 지도 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  return response.json();
}
function readCache(query) {
  try {
    const item = JSON.parse(localStorage.getItem(`sai-search:${query}`));
    if (item && Date.now() - item.time < 86400000 && Array.isArray(item.data)) return item.data;
  } catch { /* Storage is optional. */ }
  return null;
}
function cache(query, data) {
  try { localStorage.setItem(`sai-search:${query}`, JSON.stringify({ time: Date.now(), data })); } catch { /* Private browsing or full storage. */ }
}
for (const key of ['origin', 'destination']) {
  $(key).addEventListener('input', () => {
    places[key] = null;
    $(`${key}-results`).replaceChildren();
    $(`${key}-selection`).textContent = '검색 결과에서 장소를 선택하세요.';
    $(`${key}-selection`).classList.remove('chosen');
    update();
    status('변경한 장소를 다시 검색해서 선택해 주세요.');
  });
  $(`${key}-form`).addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = $(key).value.trim();
    if (searching || query.length < 2) return;
    searching = true;
    update();
    document.querySelectorAll('.search-row button').forEach((button) => { button.disabled = true; });
    $(`${key}-results`).replaceChildren();
    status('장소를 검색하고 있어요…');
    try {
      let results = readCache(query);
      if (!results) {
        const settings = await config;
        // Serialize searches in this browser, including other tabs when Web Locks is available.
        const search = async () => {
          let previous = lastRequest;
          try { previous = Math.max(previous, Number(localStorage.getItem('sai-last-search')) || 0); } catch { /* optional storage */ }
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, 1100 - (Date.now() - previous))));
          lastRequest = Date.now();
          try { localStorage.setItem('sai-last-search', String(lastRequest)); } catch { /* optional storage */ }
          const url = new URL(settings.nominatimUrl);
          url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', 'accept-language': 'ko', addressdetails: '1' });
          return request(url);
        };
        results = navigator.locks ? await navigator.locks.request('sai-nominatim', search) : await search();
        if (!Array.isArray(results)) throw new Error('장소 검색 응답이 올바르지 않습니다.');
        results = results.filter((p) => p.display_name && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)));
        cache(query, results);
      }
      if ($(key).value.trim() !== query) { status('검색어가 변경됐어요. 다시 검색해 주세요.'); return; }
      for (const place of results) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = place.display_name;
        button.addEventListener('click', () => selectPlace(key, place));
        li.append(button);
        $(`${key}-results`).append(li);
      }
      status(results.length ? '검색 결과에서 원하는 장소를 선택해 주세요.' : '검색 결과가 없습니다. 지역명이나 주소를 함께 입력해 보세요.');
    } catch (error) {
      status(error.name === 'TimeoutError' ? '검색 시간이 초과됐습니다. 다시 시도해 주세요.' : error.message);
    } finally {
      searching = false;
      document.querySelectorAll('.search-row button').forEach((button) => { button.disabled = false; });
      $('calculate').disabled = !places.origin || !places.destination || calculating;
    }
  });
}
$('mode').addEventListener('change', () => { update(); status('측정 방식을 변경했어요. 다시 계산해 주세요.'); });
$('swap').addEventListener('click', () => {
  if (searching) return;
  [places.origin, places.destination] = [places.destination, places.origin];
  for (const key of ['origin', 'destination']) {
    $(key).value = places[key] ? (places[key].name || places[key].display_name.split(',')[0]) : '';
    $(`${key}-selection`).textContent = places[key]?.display_name || '검색 결과에서 장소를 선택하세요.';
    $(`${key}-selection`).classList.toggle('chosen', Boolean(places[key]));
    $(`${key}-results`).replaceChildren();
  }
  update();
  status('출발지와 도착지를 바꿨어요.');
});
$('calculate').addEventListener('click', async () => {
  if (!places.origin || !places.destination || calculating) return;
  calculating = true;
  update();
  const current = revision;
  const a = { ...places.origin }, b = { ...places.destination };
  const straight = $('mode').value === 'straight';
  status('거리를 계산하고 있어요…');
  try {
    let meters, seconds;
    if (straight) meters = haversine(a, b);
    else if (Number(a.lat) === Number(b.lat) && Number(a.lon) === Number(b.lon)) { meters = 0; seconds = 0; }
    else {
      const settings = await config;
      const url = new URL(`${settings.routingUrl}${Number(a.lon)},${Number(a.lat)};${Number(b.lon)},${Number(b.lat)}`);
      url.search = new URLSearchParams({ overview: 'false', alternatives: 'false', steps: 'false' });
      const data = await request(url);
      if (data.code !== 'Ok' || !data.routes?.length) throw new Error('연결 가능한 자동차 경로가 없습니다. 직선거리 방식으로 확인해 주세요.');
      meters = data.routes[0].distance;
      seconds = data.routes[0].duration;
      if (!Number.isFinite(meters) || meters < 0) throw new Error('거리 응답이 올바르지 않습니다.');
    }
    if (revision !== current) return;
    const formatted = formatDistance(meters);
    $('distance').textContent = formatted.value;
    $('unit').textContent = formatted.unit;
    $('result-type').textContent = straight ? '총거리 · 직선거리' : '총거리 · 자동차 도로 거리';
    $('route-summary').textContent = `${a.name || a.display_name.split(',')[0]} → ${b.name || b.display_name.split(',')[0]}`;
    $('duration').textContent = straight ? '지구 곡률을 반영한 두 좌표 사이의 거리입니다.' : `예상 소요 시간 약 ${Math.max(0, Math.round(seconds / 60)).toLocaleString('ko-KR')}분 · 실시간 교통 미반영`;
    const map = new URL('https://www.openstreetmap.org/directions');
    map.search = new URLSearchParams({ engine: 'fossgis_osrm_car', route: `${a.lat},${a.lon};${b.lat},${b.lon}` });
    if (straight) {
      const midpointLat = (Number(a.lat) + Number(b.lat)) / 2;
      const lonDelta = ((Number(b.lon) - Number(a.lon) + 540) % 360) - 180;
      const midpointLon = ((Number(a.lon) + lonDelta / 2 + 540) % 360) - 180;
      const zoom = Math.max(1, Math.min(17, Math.floor(Math.log2(40075000 / Math.max(meters, 100))) - 1));
      map.pathname = '/'; map.search = ''; map.hash = `map=${zoom}/${midpointLat}/${midpointLon}`;
    }
    $('map-link').href = map.href;
    $('result').hidden = false;
    $('empty').hidden = true;
    status(straight ? '직선거리 계산 완료. 지도에서 보기는 두 장소 주변 지도를 엽니다.' : '거리 계산 완료. 지도에서 경로를 확인해 보세요.');
  } catch (error) {
    if (revision === current) status(error.name === 'TimeoutError' ? '계산 시간이 초과됐습니다. 다시 시도하거나 직선거리를 선택해 주세요.' : error.message);
  } finally {
    calculating = false;
    $('calculate').disabled = !places.origin || !places.destination || searching;
  }
});
