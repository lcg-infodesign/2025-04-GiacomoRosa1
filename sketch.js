//CONFIGUAZIONE
const CSV_FILE   = 'data.csv';
const MAP_IMAGE  = 'cartina.jpg';

//CARTINA, CENTRO A GREENWICH
const PROJECTION  = 'equirect';
const LON_CENTER  = 0;
const IMG_LEFT    = 0.085;
const IMG_RIGHT   = 0.975;
const IMG_TOP     = 0.060;
const IMG_BOTTOM  = 0.965;

// ALTITUDINE COLORE
const VIS_ELEV_MIN = -6000;
const VIS_ELEV_MAX =  7000;

const MARGIN = 32;

// VARIABILI
let table = null, worldImg = null;
let rows = [];
let elevMin = 0, elevMax = 1;

let mapRect   = {x:0,y:0,w:0,h:0};
let legendRect= {x:0,y:0,w:0,h:0};
let infoRect  = {x:0,y:0,w:0,h:0};

let hoverIndex = -1;
let loadError = null;

// PRELOAD
function preload() {
  try {
    table = loadTable(CSV_FILE, 'csv', 'header',
      () => console.log('[OK] CSV caricato'),
      (e) => { console.error('[ERRORE] CSV', e); loadError = 'Impossibile leggere data.csv'; }
    );

    worldImg = loadImage(MAP_IMAGE,
      () => console.log('[OK] mappa caricata'),
      () => { console.warn('[WARN] cartina.jpg non trovata'); worldImg = null; }
    );
  } catch (e) {
    console.error('[EXCEPTION] preload', e);
    loadError = 'Errore in preload: ' + e;
  }
}

// SETUP
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif');

  if (!loadError) parseTable();
  computeLayout();
  noLoop();
  redraw();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeLayout();
  redraw();
}

//
function parseTable() {
  if (!table) {
    loadError = 'Tabella CSV non disponibile';
    return;
  }

  rows = [];
  for (let r = 0; r < table.getRowCount(); r++) {
    const lat  = toNum(table.get(r, 'Latitude'));
    const lon  = toNum(table.get(r, 'Longitude'));
    const elev = toNum(table.get(r, 'Elevation (m)'));
    if (isNaN(lat) || isNaN(lon)) continue;

    rows.push({
      lat,
      lon,
      elev: isNaN(elev) ? null : elev,
      name: table.getString(r, 'Volcano Name'),
      country: table.getString(r, 'Country'),
      type: table.getString(r, 'Type'),
      typeCat: table.getString(r, 'TypeCategory'),
      status: table.getString(r, 'Status'),
      last: table.getString(r, 'Last Known Eruption')
    });
  }

  if (!rows.length) {
    loadError = 'CSV caricato, ma nessuna riga valida (controlla nomi colonne).';
  }

  const elevs = rows.map(d => d.elev).filter(v => v != null && !isNaN(v));
  elevMin = elevs.length ? min(elevs) : 0;
  elevMax = elevs.length ? max(elevs) : 1;
}

//LAYOUT
function computeLayout() {
  const topH = 64;          // titolo
  const legendH = 140;      // legenda colore
  const infoH = 140;        //dettagli vulcano

  //SPAZIO MAPPA
  const mapAvailW = width  - 2*MARGIN;
  const mapAvailH = height - topH - legendH - infoH - 4*MARGIN;

  let w = mapAvailW;
  let h = w / 2;            
  if (h > mapAvailH) {
    h = mapAvailH;
    w = h * 2;
  }

  mapRect.w = max(200, w);
  mapRect.h = max(120, h);
  mapRect.x = (width - mapRect.w) / 2;   // centrata orizzontalmente
  mapRect.y = topH + MARGIN;

  // LEGENDA SOTTO MAPPA
  legendRect.w = mapRect.w;
  legendRect.h = legendH;
  legendRect.x = mapRect.x;
  legendRect.y = mapRect.y + mapRect.h + MARGIN/2;

  // INFO VULCANI SOTTO MAPPA
  infoRect.w = mapRect.w;
  infoRect.h = infoH;
  infoRect.x = mapRect.x;
  infoRect.y = legendRect.y + legendRect.h + MARGIN/2;
}

//GEO
function wrapLon(lonDeg) {
  return ((lonDeg - LON_CENTER) + 540) % 360 - 180;
}
function lonToX(lonDeg) {
  const lon = wrapLon(lonDeg);
  const u = (lon + 180) / 360;
  const uImg = IMG_LEFT + u * (IMG_RIGHT - IMG_LEFT);
  return mapRect.x + uImg * mapRect.w;
}
function latToY(latDeg) {
  const v = (90 - latDeg) / 180;
  const vImg = IMG_TOP + v * (IMG_BOTTOM - IMG_TOP);
  return mapRect.y + vImg * mapRect.h;
}

// DRAW
function draw() {
  background(5, 7, 10);

  // Titolo
  fill(255);
  textAlign(LEFT, TOP);
  textSize(28);
  text('Vulcani del mondo', MARGIN, 8);

  if (loadError) {
    fill(255,120,120);
    textSize(16);
    textAlign(LEFT, TOP);
    text(loadError, MARGIN, 52);
    return;
  }

  hoverIndex = -1;

  // CARD MAPPA
  noStroke();
  fill(0, 0, 0, 220);
  rect(mapRect.x-12, mapRect.y-12, mapRect.w+24, mapRect.h+24, 18);

  //MAPPA
  if (worldImg) {
    tint(60, 60, 65, 255);
    image(worldImg, mapRect.x, mapRect.y, mapRect.w, mapRect.h);
    noTint();
  } else {
    fill(20);
    rect(mapRect.x, mapRect.y, mapRect.w, mapRect.h);
  }

  //GRIGLIA LEGGERA
  stroke(40,40,50,180);
  strokeWeight(1);
  for (let lon=-180; lon<=180; lon+=30) {
    const x = lonToX(lon);
    line(x, mapRect.y, x, mapRect.y + mapRect.h);
  }
  for (let lat=-60; lat<=60; lat+=30) {
    const y = latToY(lat);
    line(mapRect.x, y, mapRect.x + mapRect.w, y);
  }

  //PUNTI X VULCANI
  noStroke();
  for (let i=0; i<rows.length; i++) {
    const d = rows[i];
    const x = lonToX(d.lon);
    const y = latToY(d.lat);

    let r = 3.5;
    if (d.elev != null) {
      const norm = constrain((d.elev - elevMin) / (elevMax - elevMin), 0, 1);
      r = map(Math.sqrt(norm), 0, 1, 3.5, 8);
    }
    const col = elevToColor(d.elev);

    const isHover = dist(mouseX, mouseY, x, y) <= r + 2;
    if (isHover) hoverIndex = i;

    //COLORE PUNTI X VULCANI
    fill(red(col), green(col), blue(col), isHover ? 180 : 100);
    ellipse(x, y, r*2.4, r*2.4);

    //PIUNTO SINGOLO
    fill(col);
    ellipse(x, y, r*1.6, r*1.6);

    if (isHover) {
      stroke(255, 80, 80);
      strokeWeight(1.3);
      noFill();
      ellipse(x, y, r*2.8, r*2.8);
      noStroke();
    }
  }

  // LEGENDA E INFORNAZIONI
  drawLegendBottom();
  drawInfoPanel();
}

//COLORE X ALTITUDINE
function elevToColor(elev) {
  const e = (elev == null || isNaN(elev)) ? VIS_ELEV_MIN : elev;
  const t = constrain((e - VIS_ELEV_MIN) / (VIS_ELEV_MAX - VIS_ELEV_MIN), 0, 1);

  const c1 = color(37, 99, 235);   // blu
  const c2 = color(52, 211, 235);  // ciano
  const c3 = color(132, 239, 172); // verde chiaro

  if (t < 0.5) {
    return lerpColor(c1, c2, map(t, 0, 0.5, 0, 1));
  } else {
    return lerpColor(c2, c3, map(t, 0.5, 1, 0, 1));
  }
}

// LEGENDA IN BASO
function drawLegendBottom() {
  noStroke();
  fill(5,7,15,230);
  rect(legendRect.x, legendRect.y, legendRect.w, legendRect.h, 14);

  const barW = min(260, legendRect.w * 0.4);
  const barH = 18;
  const x = legendRect.x + (legendRect.w - barW)/2;
  const y = legendRect.y + 32;

  //TITOLO LEGENZA
  fill(255);
  textAlign(CENTER, TOP);
  textSize(14);
 text('Altezza s.l.m. – colore dei punti', legendRect.x + legendRect.w/2, legendRect.y + 10);


  //BARRA X COLORI
  for (let i=0; i<barW; i++) {
    const t = i / (barW-1);
    const col = elevToColor(lerp(VIS_ELEV_MIN, VIS_ELEV_MAX, t));
    stroke(col);
    line(x + i, y, x + i, y + barH);
  }
  noFill();
  stroke(240);
  rect(x, y, barW, barH, 8);

  // ETICHETTE NUMERI
  noStroke();
  fill(220);
  textSize(11);
  textAlign(CENTER, TOP);
  text('-6000 m', x,          y + barH + 5);
  text('0 m',     x + barW/2, y + barH + 5);
  text('+7000 m', x + barW,   y + barH + 5);

  //SCRITTA DIMENSIONE=ALTEZZA
  fill(200);
  textSize(12);
  textAlign(CENTER, TOP);
  text('Dimensione = altezza del vulcano', legendRect.x + legendRect.w/2, y + barH + 24);

}

// INFO SOTTO
function drawInfoPanel() {
  noStroke();
  fill(5,7,15,230);
  rect(infoRect.x, infoRect.y, infoRect.w, infoRect.h, 14);

  stroke(40,45,60);
  line(infoRect.x+12, infoRect.y+26, infoRect.x+infoRect.w-12, infoRect.y+26);

  noStroke();
  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);
  text('Dettagli vulcano', infoRect.x + 12, infoRect.y + 8);

  let x = infoRect.x + 16;
  let y = infoRect.y + 36;

  if (hoverIndex < 0) {
    fill(220);
    textSize(13);
    text('Passa il mouse sopra un punto sulla mappa per vedere i dettagli.', x, y);
    return;
  }

  const d = rows[hoverIndex];

  textStyle(BOLD);
  textSize(15);
  text((d.name || '—') + (d.country ? ` (${d.country})` : ''), x, y);
  y += 22;
  textStyle(NORMAL);

  textSize(13);
  const lines = [
    `Type: ${d.type || '-'}`,
    `Category: ${d.typeCat || '-'}`,
    `Status: ${d.status || '-'}`,
    '',
    `Lat: ${formatNum(d.lat)}`,
    `Lon: ${formatNum(d.lon)}`,
    d.elev != null ? `Elevation: ${formatNum(d.elev)} m` : 'Elevation: n.d.',
    d.last ? `Last Known Eruption: ${d.last}` : 'Last Known Eruption: n.d.'
  ];

  for (const L of lines) {
    text(L, x, y);
    y += 18;
  }
}

// INTERAZIONE CON MOUSE
function mouseMoved() {
  redraw();
}



function toNum(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  let s = (''+v).trim();
  if (s === '' || /^na|null|unknown$/i.test(s)) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g,'').replace(',','.');
    else s = s.replace(/,/g,'');
  } else if (lastComma > -1) {
    s = s.replace(',','.');
  }
  return parseFloat(s);
}

function formatNum(v) {
  if (v == null || isNaN(v)) return 'n.d.';
  return nf(v, 0, 3);
}
