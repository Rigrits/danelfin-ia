#!/usr/bin/env python3
"""
Seguimiento de recomendaciones Danelfin AI (TP IA - Sistema Financiero Internacional)

Qué hace
  1. Lee recomendaciones.csv (ticker, fecha, AI Score, entrada, SL, TP). Los mails .eml se convierten
     a ese CSV con --importar-eml y nunca se suben al repositorio.
  2. Baja precios diarios OHLCV (yfinance primero, Massive de respaldo, caché en cache/).
  3. Detecta si cada acción tocó el Stop Loss / Take Profit (con máximos y mínimos diarios,
     aunque el cierre haya recuperado) y calcula el rendimiento real y el "hold".
  4. Calcula ADX/+DI/-DI, RSI, MFI, MACD y EMAs (20/50/200) con suavizado de Wilder.
  5. Regenera el Excel (web/descargas/), los datos de la web (web/data/datos.js) y agrega los cierres
     de la última rueda a data/cierres.csv (dato diario que el workflow commitea).

Uso
  python seguimiento_danelfin.py                          # corte: última rueda cerrada
  python seguimiento_danelfin.py --importar-eml ../Danelfin   # agrega los mails nuevos a recomendaciones.csv
  python seguimiento_danelfin.py --corte ultimo-viernes   # valúa al último viernes en vez de a la última rueda
  python seguimiento_danelfin.py --end 2026-12-18         # corte en otra fecha
  python seguimiento_danelfin.py --refresh                # ignora la caché y vuelve a bajar todo
  python seguimiento_danelfin.py --verify                 # contrasta yfinance contra Massive
  python seguimiento_danelfin.py --debug-indicators RTX   # imprime indicadores (para validar con TradingView)

Requisitos
  pip install -r requirements.txt
  Archivo .env (opcional, solo para el respaldo y --verify) junto al script:
      MASSIVE_API_KEY=tu_clave
"""
from __future__ import annotations

import argparse
import datetime as dt
import email
import json
import os
import re
import shutil
import sys
import time
from email import policy
from html import unescape
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import xlsxwriter
from xlsxwriter.utility import xl_col_to_name

# ============================================================== CONFIGURACIÓN
BASE = Path(__file__).resolve().parent
RECS_CSV = BASE / "recomendaciones.csv"
SITE_DIR = BASE / "web"
OUT_XLSX = SITE_DIR / "descargas" / "Seguimiento_Danelfin_IA.xlsx"
CIERRES_CSV = BASE / "data" / "cierres.csv"
CACHE_DIR = BASE / "cache"

INTEGRANTES = ["Vivas", "Devita", "Rodriguez", "Toffoletti", "Sanguinetti", "Guevara"]   # se muestran en orden alfabético
EQUIPO_NOMBRE = ""                 # nombre del equipo (el TP pide ponerle uno); vacío = no se muestra

BENCHMARK = "SPY"                 # S&P 500 (ETF)
HISTORY_DAYS = 420                # historia previa a la 1ª recomendación (EMA 200, ADX)
VERIFY_THRESHOLD = 0.005          # 0,5 %: diferencia entre fuentes que se reporta
ADX_LEN, RSI_LEN, MFI_LEN = 14, 14, 14
EMA_LENS = (20, 50, 200)
MACD_FAST, MACD_SLOW, MACD_SIGNAL = 12, 26, 9
MASSIVE_URL = "https://api.massive.com"
TZ_MARKET = "America/New_York"

SEG = "Seguimiento"
WEEK = "Rendimiento por viernes"
BENCH = "Benchmark S&P 500"
IND = "Indicadores técnicos"

MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"


# ===================================================================== UTILES
def log(msg: str) -> None:
    print(msg, flush=True)


def load_env() -> dict:
    env = {}
    p = BASE / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def market_closed_today() -> bool:
    n = pd.Timestamp.now(tz=TZ_MARKET)
    return n.hour * 60 + n.minute >= 16 * 60 + 15


def today_et() -> pd.Timestamp:
    return pd.Timestamp.now(tz=TZ_MARKET).tz_localize(None).normalize()


def expected_last_session(end: pd.Timestamp) -> pd.Timestamp:
    d = end
    if d == today_et() and not market_closed_today():
        d -= pd.Timedelta(days=1)
    while d.weekday() >= 5:
        d -= pd.Timedelta(days=1)
    return d


# ================================================================ PARSER .EML
def parse_eml(path: Path) -> dict:
    msg = email.message_from_file(open(path, encoding="utf8", errors="replace"), policy=policy.default)
    body = msg.get_body(preferencelist=("html", "plain"))
    if body is None:
        raise ValueError("sin cuerpo")
    t = body.get_content()
    t = re.sub(r"<(script|style).*?</\1>", " ", t, flags=re.S)
    t = unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"\s+", " ", t)

    subj = re.search(r"Trade Idea of the Week:\s*([A-Z][A-Z.\-]*)\s*\((.*?)\)", str(msg["Subject"]))
    d = re.search(rf"\b({MONTHS}) (\d{{1,2}}), (20\d\d)\b", t)
    score = re.search(r"AI Score of (\d+)/10", t)
    prob = re.search(r"([\d.]+)% probability of beating the market", t)
    par = re.search(
        r"Entry price: \$([\d,.]+) Horizon: (.*?) Stop Loss: \$([\d,.]+) \( ?([-+\d.]+)% ?\).*?"
        r"Take Profit: \$([\d,.]+) \( ?([-+\d.]+)% ?\)", t)
    hist = re.search(r"achieved in the past a ([\d.]+)% win rate.*?and a ([+-]?[\d.]+)% average performance", t)

    missing = [n for n, v in [("ticker", subj), ("fecha", d), ("AI Score", score),
                              ("probabilidad", prob), ("parámetros de trading", par)] if v is None]
    if missing:
        raise ValueError("faltan campos: " + ", ".join(missing))
    num = lambda s: float(s.replace(",", ""))
    return dict(
        t=subj.group(1), name=subj.group(2).strip(),
        rec_date=pd.Timestamp(dt.datetime.strptime(f"{d.group(1)} {d.group(2)} {d.group(3)}", "%B %d %Y")),
        score=int(score.group(1)), prob=float(prob.group(1)) / 100,
        entry=num(par.group(1)), horizon=par.group(2).strip(),
        sl=num(par.group(3)), tp=num(par.group(5)),
        winrate=float(hist.group(1)) / 100 if hist else None,
        avgret=float(hist.group(2)) / 100 if hist else None,
        file=path.name,
    )


def parse_emls(eml_dir: Path) -> list[dict]:
    files = sorted(eml_dir.glob("*.eml"))
    if not files:
        sys.exit(f"No hay .eml en {eml_dir}")
    recs, seen = [], set()
    for f in files:
        try:
            r = parse_eml(f)
        except Exception as e:  # error explícito, no se omite en silencio
            sys.exit(f"ERROR parseando {f.name}: {e}")
        key = (r["t"], r["rec_date"])
        if key in seen:
            log(f"  aviso: mail duplicado {r['t']} {r['rec_date']:%d/%m/%Y} ({f.name}) - se ignora")
            continue
        seen.add(key)
        recs.append(r)
    recs.sort(key=lambda r: (r["rec_date"], r["t"]))
    return recs


# ===================================================== RECOMENDACIONES (CSV)
REC_FIELDS = ["ticker", "empresa", "fecha_rec", "score", "prob", "entry", "sl", "tp", "horizonte", "winrate", "avgret"]


def load_recs(path: Path) -> list[dict]:
    """Lee recomendaciones.csv (única entrada del workflow; los .eml no se versionan)."""
    if not path.exists():
        sys.exit(f"No existe {path.name}. Generalo con:  python seguimiento_danelfin.py --importar-eml <carpeta con los .eml>")
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    faltan = [c for c in REC_FIELDS[:8] if c not in df.columns]
    if faltan:
        sys.exit(f"ERROR: a {path.name} le faltan columnas: {', '.join(faltan)}")
    recs, seen = [], set()
    for i, row in df.iterrows():
        try:
            r = dict(
                t=row["ticker"].strip().upper(), name=row["empresa"].strip(),
                rec_date=pd.Timestamp(row["fecha_rec"]), score=int(row["score"]),
                prob=float(row["prob"]), entry=float(row["entry"]), sl=float(row["sl"]), tp=float(row["tp"]),
                horizon=(row.get("horizonte") or "3 months").strip(),
                winrate=float(row["winrate"]) if row.get("winrate") else None,
                avgret=float(row["avgret"]) if row.get("avgret") else None,
            )
        except Exception as e:
            sys.exit(f"ERROR en {path.name}, fila {i + 2}: {e}")
        if not (r["sl"] < r["entry"] < r["tp"]):
            sys.exit(f"ERROR en {path.name}, fila {i + 2} ({r['t']}): se espera SL < entrada < TP")
        key = (r["t"], r["rec_date"])
        if key in seen:
            sys.exit(f"ERROR en {path.name}: {r['t']} {r['rec_date']:%d/%m/%Y} está duplicada")
        seen.add(key)
        recs.append(r)
    if not recs:
        sys.exit(f"{path.name} no tiene filas")
    recs.sort(key=lambda r: (r["rec_date"], r["t"]))
    return recs


def save_recs(recs: list[dict], path: Path) -> None:
    rows = [{
        "ticker": r["t"], "empresa": r["name"], "fecha_rec": f"{r['rec_date']:%Y-%m-%d}", "score": r["score"],
        "prob": round(r["prob"], 4), "entry": r["entry"], "sl": r["sl"], "tp": r["tp"], "horizonte": r["horizon"],
        "winrate": "" if r["winrate"] is None else round(r["winrate"], 4),
        "avgret": "" if r["avgret"] is None else round(r["avgret"], 4),
    } for r in sorted(recs, key=lambda r: (r["rec_date"], r["t"]))]
    pd.DataFrame(rows, columns=REC_FIELDS).to_csv(path, index=False)


def importar_eml(eml_dir: Path, path: Path) -> None:
    """Convierte los .eml nuevos en filas de recomendaciones.csv (corre en la PC del usuario)."""
    nuevas = parse_emls(eml_dir)
    actuales = {(r["t"], r["rec_date"]): r for r in load_recs(path)} if path.exists() else {}
    agregadas = 0
    for r in nuevas:
        k = (r["t"], r["rec_date"])
        if k in actuales:
            ya = actuales[k]
            if any(abs(ya[c] - r[c]) > 1e-9 for c in ("entry", "sl", "tp")):
                log(f"  aviso: {r['t']} {r['rec_date']:%d/%m/%Y} ya existe con otros valores; se conserva lo que había")
            continue
        actuales[k] = r
        agregadas += 1
        log(f"  + {r['t']:5s} {r['rec_date']:%d/%m/%Y}  entrada {r['entry']}  SL {r['sl']}  TP {r['tp']}")
    save_recs(list(actuales.values()), path)
    log(f"{agregadas} recomendaciones nuevas; total {len(actuales)} en {path.name}")


# ============================================================ DESCARGA PRECIOS
def fetch_yf(t: str, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame | None:
    import yfinance as yf
    df = yf.Ticker(t).history(start=start.strftime("%Y-%m-%d"),
                              end=(end + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
                              interval="1d", auto_adjust=False, actions=False)
    if df is None or df.empty:
        return None
    df = df.rename(columns=str.lower)[["open", "high", "low", "close", "volume"]]
    df[["open", "high", "low", "close"]] = df[["open", "high", "low", "close"]].round(4)
    df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
    return df.dropna(subset=["close"])


def fetch_massive(t: str, start: pd.Timestamp, end: pd.Timestamp, key: str) -> pd.DataFrame | None:
    url = f"{MASSIVE_URL}/v2/aggs/ticker/{t}/range/1/day/{start:%Y-%m-%d}/{end:%Y-%m-%d}"
    params = {"adjusted": "true", "sort": "asc", "limit": 50000, "apiKey": key}
    for _ in range(8):
        r = requests.get(url, params=params, timeout=30)
        if r.status_code == 429:           # límite de pedidos por minuto: esperar y reintentar
            time.sleep(15)
            continue
        r.raise_for_status()
        break
    else:
        raise RuntimeError("Massive: límite de pedidos (429) tras varios reintentos")
    res = r.json().get("results") or []
    if not res:
        return None
    df = pd.DataFrame(res)
    idx = pd.to_datetime(df["t"], unit="ms", utc=True).dt.tz_convert(TZ_MARKET).dt.tz_localize(None).dt.normalize()
    out = pd.DataFrame({"open": df["o"], "high": df["h"], "low": df["l"], "close": df["c"],
                        "volume": df["v"]})
    out.index = idx
    return out


def get_ohlcv(t: str, start: pd.Timestamp, end: pd.Timestamp, refresh: bool, key: str | None,
              warnings: list[str]) -> tuple[pd.DataFrame, str]:
    CACHE_DIR.mkdir(exist_ok=True)
    cpath = CACHE_DIR / f"{t}.csv"
    target = expected_last_session(end)
    cached = None
    if cpath.exists():
        c = pd.read_csv(cpath, parse_dates=["date"], index_col="date")
        src = str(c["source"].iloc[-1]) if "source" in c else "caché"
        cached = (c.drop(columns=["source"], errors="ignore"), src)
        if (not refresh and cached[0].index.min() <= start + pd.Timedelta(days=7)
                and cached[0].index.max() >= target):
            return cached[0].loc[:end], f"caché ({src})"

    df, src = None, ""
    try:
        y = fetch_yf(t, start, end)
        if y is not None and y.index.max() >= target - pd.Timedelta(days=3):
            df, src = y, "yfinance"
        elif y is not None:
            warnings.append(f"{t}: yfinance devolvió datos hasta {y.index.max():%d/%m/%Y} (se esperaba {target:%d/%m/%Y})")
            df, src = y, "yfinance"
    except Exception as e:
        warnings.append(f"{t}: falló yfinance ({type(e).__name__}: {e})")

    if df is None or df.index.max() < target:
        if key:
            try:
                m = fetch_massive(t, start, end, key)
                if m is not None and (df is None or m.index.max() > df.index.max()):
                    df, src = m, "Massive (respaldo)"
            except Exception as e:
                warnings.append(f"{t}: falló Massive ({type(e).__name__}: {e})")
        elif df is None:
            warnings.append(f"{t}: sin respaldo Massive (falta MASSIVE_API_KEY en .env)")

    if df is None:
        if cached is not None:
            warnings.append(f"{t}: sin fuente disponible, se usa la caché vieja")
            return cached[0].loc[:end], f"caché vieja ({cached[1]})"
        sys.exit(f"ERROR: no se pudieron obtener precios de {t}")

    if end == today_et() and not market_closed_today():   # barra parcial del día en curso
        df = df[df.index < end]
    out = df.copy()
    out["source"] = src
    out.to_csv(cpath, index_label="date")
    return df.loc[:end], src


def verify_sources(t: str, df: pd.DataFrame, key: str | None, warnings: list[str]) -> None:
    if not key:
        warnings.append("--verify requiere MASSIVE_API_KEY en .env")
        return
    m = fetch_massive(t, df.index.min(), df.index.max(), key)
    if m is None:
        warnings.append(f"{t}: Massive no devolvió datos para contrastar")
        return
    j = df[["close"]].join(m[["close"]], how="inner", rsuffix="_m")
    diff = ((j["close"] - j["close_m"]).abs() / j["close_m"])
    bad = diff[diff > VERIFY_THRESHOLD]
    msg = f"{t}: {len(j)} días comparados, diferencia máx {diff.max():.2%}"
    if len(bad):
        msg += f", {len(bad)} días > {VERIFY_THRESHOLD:.1%} (ej. {bad.index[0]:%d/%m/%Y})"
        warnings.append("DIFERENCIA ENTRE FUENTES - " + msg)
    log("  verify " + msg)


# ================================================================ INDICADORES
def rma(s: pd.Series, n: int) -> pd.Series:
    """Media de Wilder (RMA), sembrada con la SMA de los primeros n valores (como TradingView)."""
    v = s.to_numpy(float)
    out = np.full(len(v), np.nan)
    valid = np.where(~np.isnan(v))[0]
    if len(valid) < n:
        return pd.Series(out, index=s.index)
    i0 = valid[0] + n - 1
    out[i0] = v[valid[0]:i0 + 1].mean()
    for i in range(i0 + 1, len(v)):
        out[i] = (out[i - 1] * (n - 1) + v[i]) / n
    return pd.Series(out, index=s.index)


def indicators(df: pd.DataFrame) -> pd.DataFrame:
    h, l, c, v = df["high"], df["low"], df["close"], df["volume"]
    out = pd.DataFrame(index=df.index)
    # ADX / +DI / -DI
    pc = c.shift(1)
    tr = pd.concat([h - l, (h - pc).abs(), (l - pc).abs()], axis=1).max(axis=1)
    tr.iloc[0] = np.nan
    up, dn = h.diff(), -l.diff()
    pdm = pd.Series(np.where((up > dn) & (up > 0), up, 0.0), index=df.index)
    mdm = pd.Series(np.where((dn > up) & (dn > 0), dn, 0.0), index=df.index)
    pdm.iloc[0] = mdm.iloc[0] = np.nan
    atr = rma(tr, ADX_LEN)
    out["+DI"] = 100 * rma(pdm, ADX_LEN) / atr
    out["-DI"] = 100 * rma(mdm, ADX_LEN) / atr
    dx = 100 * (out["+DI"] - out["-DI"]).abs() / (out["+DI"] + out["-DI"])
    out["ADX"] = rma(dx, ADX_LEN)
    # RSI
    d = c.diff()
    ag, al = rma(d.clip(lower=0), RSI_LEN), rma((-d).clip(lower=0), RSI_LEN)
    out["RSI"] = np.where(al == 0, 100.0, 100 - 100 / (1 + ag / al))
    out.loc[ag.isna(), "RSI"] = np.nan
    # MFI
    tp = (h + l + c) / 3
    rmf = tp * v
    pos = rmf.where(tp > tp.shift(1), 0.0)
    neg = rmf.where(tp < tp.shift(1), 0.0)
    pos.iloc[0] = neg.iloc[0] = np.nan
    ps, ns = pos.rolling(MFI_LEN).sum(), neg.rolling(MFI_LEN).sum()
    out["MFI"] = np.where(ns == 0, 100.0, 100 - 100 / (1 + ps / ns))
    out.loc[ps.isna(), "MFI"] = np.nan
    # EMAs
    for n in EMA_LENS:
        out[f"EMA{n}"] = c.ewm(span=n, adjust=False).mean()
    # MACD (12, 26, 9)
    macd = c.ewm(span=MACD_FAST, adjust=False).mean() - c.ewm(span=MACD_SLOW, adjust=False).mean()
    out["MACD"] = macd
    out["MACD_signal"] = macd.ewm(span=MACD_SIGNAL, adjust=False).mean()
    out["MACD_hist"] = out["MACD"] - out["MACD_signal"]
    out["close"] = c
    return out


# =============================================================== SL / TP
def find_exit(df: pd.DataFrame, entry_day: pd.Timestamp, val_date: pd.Timestamp, sl: float, tp: float):
    """Primera rueda (desde el día de entrada) en que el precio toca SL o TP.
    Gap: si abre más allá del nivel, se sale a la apertura. Si toca ambos el mismo día se
    asume SL (lectura conservadora) y se marca como ambiguo."""
    for d, r in df.loc[entry_day:val_date].iterrows():
        if r["open"] <= sl:
            return dict(date=d, price=float(r["open"]), kind="SL", ambiguous=False)
        if r["open"] >= tp:
            return dict(date=d, price=float(r["open"]), kind="TP", ambiguous=False)
        sl_hit, tp_hit = r["low"] <= sl, r["high"] >= tp
        if sl_hit and tp_hit:
            return dict(date=d, price=sl, kind="SL", ambiguous=True)
        if sl_hit:
            return dict(date=d, price=sl, kind="SL", ambiguous=False)
        if tp_hit:
            return dict(date=d, price=tp, kind="TP", ambiguous=False)
    return None


def px_on(df: pd.DataFrame, d: pd.Timestamp) -> tuple[pd.Timestamp, float]:
    s = df["close"].loc[:d]
    return s.index[-1], float(s.iloc[-1])


def prev_session(df: pd.DataFrame, d: pd.Timestamp) -> pd.Timestamp:
    s = df.index[df.index < d]
    return s[-1]


# =============================================================== CONSTRUCCIÓN
def build(recs, data, spy, fridays, val_date, warnings):
    rows = []
    for r in recs:
        df = data[r["t"]]["df"]
        ind = data[r["t"]]["ind"]
        o = dict(r)
        o["source"] = data[r["t"]]["src"]
        notes = []
        after = df.index[df.index >= r["rec_date"]]
        if len(after) == 0 or after[0] > val_date:
            o.update(entry_day=None, exit=None, status="Sin datos aún", fri_px=[], last_px=None,
                     real=None, hold=None, recovered="—", notes=["Recomendación posterior al corte"])
            rows.append(o)
            continue
        entry_day = after[0]
        if entry_day != r["rec_date"]:
            notes.append(f"Sin rueda el {r['rec_date']:%d/%m}: entrada {entry_day:%d/%m}")
        ex = find_exit(df, entry_day, val_date, r["sl"], r["tp"])
        fri_px = [px_on(df, f)[1] for f in fridays]
        last_px = px_on(df, val_date)[1]
        o.update(entry_day=entry_day, exit=ex, fri_px=fri_px, last_px=last_px)
        o["hold"] = last_px / r["entry"] - 1
        if ex:
            o["status"] = "Stop Loss" if ex["kind"] == "SL" else "Take Profit"
            if ex["ambiguous"]:
                o["status"] += " (ambiguo)"
                notes.append("SL y TP tocados el mismo día: se asume SL")
                warnings.append(f"{r['t']}: SL y TP tocados el mismo día ({ex['date']:%d/%m/%Y}), se asume SL")
            o["real"] = ex["price"] / r["entry"] - 1
            fd = next((f for f in fridays if f >= ex["date"]), val_date)
            fc = px_on(df, fd)[1]
            if ex["kind"] == "SL":
                o["recovered"] = (f"Recuperó: cerró {fc:.2f} (> SL)" if fc > r["sl"]
                                  else f"No recuperó: cerró {fc:.2f}")
            else:
                o["recovered"] = f"Cerró {fc:.2f} ({'≥' if fc >= r['tp'] else '<'} TP)"
        else:
            o["status"], o["real"], o["recovered"] = "Abierta", o["hold"], "—"
        if o["source"].startswith("Massive") or "caché vieja" in o["source"]:
            notes.append(f"Fuente: {o['source']}")
        o["notes"] = notes
        # indicadores al entrar (cierre previo a la entrada: lo que se conocía al recomendar) y cada viernes
        snaps = []
        pd_ = prev_session(df, entry_day)
        snaps.append(("Al entrar (cierre previo)", pd_, True))
        for f in fridays:
            if f > r["rec_date"]:
                snaps.append((f"Viernes {f:%d/%m/%y}", f, ex is None or f < ex["date"]))
        if val_date not in fridays and val_date > r["rec_date"]:
            snaps.append((f"Último cierre {val_date:%d/%m/%y}", val_date, ex is None or val_date < ex["date"]))
        o["snaps"] = []
        for label, d, abierta in snaps:
            dd, _ = px_on(df, d)
            row = ind.loc[dd]
            o["snaps"].append(dict(label=label, date=dd, row=row,
                                   pos="Abierta" if abierta else "Cerrada"))
        # SPY base: cierre previo a la entrada (≈ convención de Danelfin: entrada ~ cierre previo)
        base_d = prev_session(spy, entry_day)
        o["spy_base"] = (base_d, float(spy.loc[base_d, "close"]))
        end_d = ex["date"] if ex else val_date
        o["spy_end"] = px_on(spy, end_d)
        o["spy_val"] = px_on(spy, val_date)
        rows.append(o)
    return rows


# =================================================================== EXCEL
def write_excel(rows, fridays, val_date, params_info, warnings, out_path: Path):
    wb = xlsxwriter.Workbook(str(out_path))
    F = lambda **k: wb.add_format({"font_name": "Calibri", "font_size": 10, **k})
    f_head = F(bold=True, bg_color="#1F3864", font_color="white", text_wrap=True, valign="vcenter",
               align="center", border=1)
    f_txt, f_ctr = F(border=1), F(border=1, align="center")
    f_date = F(border=1, num_format="dd/mm/yyyy", align="center")
    f_px, f_pxg = F(border=1, num_format="#,##0.00"), F(border=1, num_format="#,##0.00", font_color="#A6A6A6", italic=True)
    f_pct, f_pct1 = F(border=1, num_format="0.00%"), F(border=1, num_format="0.0%", align="center")
    f_int = F(border=1, align="center", num_format="0")
    f_hdate = F(bold=True, bg_color="#1F3864", font_color="white", num_format="dd/mm/yy", align="center", border=1)
    f_title = F(bold=True, font_size=14, font_color="#1F3864")
    f_sub = F(bold=True, font_size=11, font_color="#1F3864")
    f_note = F(italic=True, font_color="#595959", text_wrap=True, valign="top")
    f_lbl = F(border=1, bold=True, bg_color="#D9E1F2")
    f_green, f_red = F(font_color="#006100", bg_color="#C6EFCE"), F(font_color="#9C0006", bg_color="#FFC7CE")
    f_hide = F(font_color="#FFFFFF")
    f_amber, f_blue = F(font_color="#7F6000", bg_color="#FFEB9C"), F(font_color="#1F4E79", bg_color="#DDEBF7")
    f_head_op = F(bold=True, bg_color="#2F5597", font_color="white", text_wrap=True, valign="vcenter", align="center", border=1)
    f_head_fr = F(bold=True, bg_color="#44546A", font_color="white", text_wrap=True, valign="vcenter", align="center", border=1)
    f_head_rs = F(bold=True, bg_color="#375623", font_color="white", text_wrap=True, valign="vcenter", align="center", border=1)

    def pct_cf(ws, rng):
        ws.conditional_format(rng, {"type": "cell", "criteria": ">", "value": 0, "format": f_green})
        ws.conditional_format(rng, {"type": "cell", "criteria": "<", "value": 0, "format": f_red})

    n = len(rows)
    nF = len(fridays)
    r0, r1 = 2, n + 1                       # filas Excel (1-based) con datos en Seguimiento
    ws_seg = wb.add_worksheet(SEG)
    ws_wk = wb.add_worksheet(WEEK)
    ws_bm = wb.add_worksheet(BENCH)
    ws_ind = wb.add_worksheet(IND)

    # ---------- Seguimiento
    heads = ["Ticker", "Empresa", "Fecha de Recomendación", "Recomendación", "AI Score",
             "Prob. superar mercado (3M)", "Win rate hist. 3M (Danelfin)", "Retorno prom. hist. 3M (Danelfin)",
             "Precio de Entrada", "Stop Loss", "Take Profit", "Estado", "Fecha de Salida",
             "Precio de Salida (SL/TP)", "Cierre del viernes vs nivel", "Notas"]
    C = {h: i for i, h in enumerate(heads)}
    fcol0 = len(heads)
    heads += [f"Precio Vie {f:%d/%m/%y}" for f in fridays] + [f"Último cierre {val_date:%d/%m/%y}",
                                                             "Rendimiento Real (con SL/TP)",
                                                             "Rendimiento Hold (sin SL/TP)"]
    cR, cH = fcol0 + nF + 1, fcol0 + nF + 2
    L = lambda name: xl_col_to_name(C[name])
    cEnt, cEx, cExP = L("Precio de Entrada"), L("Fecha de Salida"), L("Precio de Salida (SL/TP)")
    cRec, cSt = L("Fecha de Recomendación"), L("Estado")
    cLast = xl_col_to_name(fcol0 + nF)           # columna 'Último cierre'
    cRL, cHL = xl_col_to_name(cR), xl_col_to_name(cH)
    ws_seg.set_row(0, 48)
    for i, h in enumerate(heads):
        ws_seg.write(0, i, h, f_head if i < 8 else f_head_op if i < fcol0 else f_head_fr if i < cR else f_head_rs)
    for i, r in enumerate(rows, start=1):
        x = i + 1
        ex = r["exit"]
        ws_seg.write(i, C["Ticker"], r["t"], F(border=1, bold=True))
        ws_seg.write(i, C["Empresa"], r["name"], f_txt)
        ws_seg.write_datetime(i, C["Fecha de Recomendación"], r["rec_date"].to_pydatetime(), f_date)
        ws_seg.write(i, C["Recomendación"], "BUY", f_ctr)
        ws_seg.write(i, C["AI Score"], r["score"], f_int)
        ws_seg.write(i, C["Prob. superar mercado (3M)"], r["prob"], f_pct1)
        for k, key in (("Win rate hist. 3M (Danelfin)", "winrate"), ("Retorno prom. hist. 3M (Danelfin)", "avgret")):
            (ws_seg.write(i, C[k], r[key], f_pct1) if r[key] is not None else ws_seg.write_blank(i, C[k], None, f_txt))
        ws_seg.write(i, C["Precio de Entrada"], r["entry"], f_px)
        ws_seg.write(i, C["Stop Loss"], r["sl"], f_px)
        ws_seg.write(i, C["Take Profit"], r["tp"], f_px)
        ws_seg.write(i, C["Estado"], r["status"], f_ctr)
        if ex:
            ws_seg.write_datetime(i, C["Fecha de Salida"], ex["date"].to_pydatetime(), f_date)
            ws_seg.write(i, C["Precio de Salida (SL/TP)"], ex["price"], f_px)
        else:
            ws_seg.write_blank(i, C["Fecha de Salida"], None, f_txt)
            ws_seg.write_blank(i, C["Precio de Salida (SL/TP)"], None, f_txt)
        ws_seg.write(i, C["Cierre del viernes vs nivel"], r["recovered"], f_txt)
        ws_seg.write(i, C["Notas"], "; ".join(r["notes"]), f_txt)
        for j, f in enumerate(fridays):
            if r["fri_px"]:
                pre = f < r["rec_date"]
                ws_seg.write(i, fcol0 + j, r["fri_px"][j], f_pxg if pre else f_px)
            else:
                ws_seg.write_blank(i, fcol0 + j, None, f_txt)
        if r["last_px"] is not None:
            ws_seg.write(i, fcol0 + nF, r["last_px"], f_px)
        else:
            ws_seg.write_blank(i, fcol0 + nF, None, f_txt)
        if r["real"] is not None:
            ws_seg.write_formula(i, cR, f'=IF(ISNUMBER({cExP}{x}),{cExP}{x},{cLast}{x})/{cEnt}{x}-1', f_pct, r["real"])
            ws_seg.write_formula(i, cH, f'={cLast}{x}/{cEnt}{x}-1', f_pct, r["hold"])
        else:
            ws_seg.write_blank(i, cR, None, f_pct)
            ws_seg.write_blank(i, cH, None, f_pct)
    pct_cf(ws_seg, f"{cRL}{r0}:{cHL}{r1}")
    stc = f"{cSt}{r0}:{cSt}{r1}"
    for txt, fmt in (("Stop", f_red), ("Take", f_green), ("Abierta", f_amber)):
        ws_seg.conditional_format(stc, {"type": "text", "criteria": "begins with", "value": txt, "format": fmt})
    ws_seg.set_column(0, 0, 8)
    ws_seg.set_column(1, 1, 26)
    ws_seg.set_column(2, 10, 12)
    ws_seg.set_column(11, 11, 17)
    ws_seg.set_column(12, 13, 12)
    ws_seg.set_column(14, 14, 28)
    ws_seg.set_column(15, 15, 34)
    ws_seg.set_column(fcol0, cH, 12)
    ws_seg.freeze_panes(1, 2)
    ws_seg.autofilter(0, 0, n, cH)

    S = f"'{SEG}'!"
    rng = lambda col: f"{S}${col}${r0}:${col}${r1}"

    # ---------- Rendimiento por viernes (Real y Hold)
    hdr_real, hdr_hold = 1, 1 + n + 4      # filas (0-based) de los encabezados
    ws_wk.write(0, 0, "Rendimiento REAL desde la entrada (se congela en el precio de salida si tocó SL/TP)", f_sub)
    ws_wk.write(hdr_hold - 1, 0, "Rendimiento HOLD desde la entrada (sin aplicar SL/TP)", f_sub)
    for hrow in (hdr_real, hdr_hold):
        ws_wk.write(hrow, 0, "Ticker", f_head)
        ws_wk.write(hrow, 1, "Fecha Rec.", f_head)
        for j, f in enumerate(fridays):
            ws_wk.write_datetime(hrow, 2 + j, f.to_pydatetime(), f_hdate)
    for i, r in enumerate(rows):
        x = i + 2
        for hrow, mode in ((hdr_real, "real"), (hdr_hold, "hold")):
            row = hrow + 1 + i
            ws_wk.write_formula(row, 0, f"={S}A{x}", F(border=1, bold=True), r["t"])
            ws_wk.write_formula(row, 1, f"={S}{cRec}{x}", f_date, (r["rec_date"] - pd.Timestamp("1899-12-30")).days)
            for j, f in enumerate(fridays):
                col = xl_col_to_name(2 + j)
                pc = xl_col_to_name(fcol0 + j)
                hd = f"{col}${hrow + 1}"
                ex = r["exit"]
                if not r["fri_px"] or f <= r["rec_date"]:
                    val = "#N/A"
                elif mode == "real" and ex and f >= ex["date"]:
                    val = ex["price"] / r["entry"] - 1
                else:
                    val = r["fri_px"][j] / r["entry"] - 1
                if mode == "real":
                    fm = (f"=IF({hd}<=$B{row + 1},NA(),IF(AND(ISNUMBER({S}${cEx}{x}),{hd}>={S}${cEx}{x}),"
                          f"{S}${cExP}{x},{S}{pc}{x})/{S}${cEnt}{x}-1)")
                else:
                    fm = f"=IF({hd}<=$B{row + 1},NA(),{S}{pc}{x}/{S}${cEnt}{x}-1)"
                ws_wk.write_formula(row, 2 + j, fm, f_pct, val)
    for hrow in (hdr_real, hdr_hold):
        rg = f"C{hrow + 2}:{xl_col_to_name(1 + nF)}{hrow + 1 + n}"
        ws_wk.conditional_format(rg, {"type": "errors", "format": f_hide})
        pct_cf(ws_wk, rg)
    ws_wk.set_column(0, 0, 8)
    ws_wk.set_column(1, 1, 12)
    ws_wk.set_column(2, 2 + nF, 10)
    ws_wk.freeze_panes(0, 2)
    for hrow, ttl, anchor in ((hdr_real, "Rendimiento real por viernes", f"A{hdr_hold + n + 4}"),
                              (hdr_hold, "Rendimiento hold por viernes", f"K{hdr_hold + n + 4}")):
        ch = wb.add_chart({"type": "line"})
        for i in range(n):
            ch.add_series({"name": [WEEK, hrow + 1 + i, 0],
                           "categories": [WEEK, hrow, 2, hrow, 1 + nF],
                           "values": [WEEK, hrow + 1 + i, 2, hrow + 1 + i, 1 + nF],
                           "marker": {"type": "circle", "size": 4}, "line": {"width": 1.75}})
        ch.set_title({"name": ttl})
        ch.set_y_axis({"num_format": "0%", "major_gridlines": {"visible": True, "line": {"color": "#D9D9D9"}}})
        ch.set_x_axis({"num_format": "dd/mm", "date_axis": False, "label_position": "low"})
        ch.set_legend({"position": "right"})
        ch.set_size({"width": 760, "height": 380})
        ws_wk.insert_chart(anchor, ch)

    # ---------- Benchmark
    bh = ["Ticker", "Fecha Rec.", "SPY base: fecha (cierre previo a la entrada)", "SPY base: precio",
          "Fin ventana real (salida o último viernes)", "SPY precio fin real", "SPY rend. ventana real",
          "Acción: rend. real", "Alpha real (acción - SPY)", "SPY precio último viernes",
          "SPY rend. hasta último viernes", "Acción: rend. hold", "Alpha hold (acción - SPY)"]
    ws_bm.set_row(0, 62)
    for i, h in enumerate(bh):
        ws_bm.write(0, i, h, f_head)
    alpha_r, alpha_h, spy_r = [], [], []
    for i, r in enumerate(rows, start=1):
        x = i + 1
        ws_bm.write_formula(i, 0, f"={S}A{x}", F(border=1, bold=True), r["t"])
        ws_bm.write_formula(i, 1, f"={S}{cRec}{x}", f_date, (r["rec_date"] - pd.Timestamp("1899-12-30")).days)
        if r["real"] is None:
            for c_ in range(2, 13):
                ws_bm.write_blank(i, c_, None, f_txt)
            alpha_r.append(None); alpha_h.append(None); spy_r.append(None)
            continue
        bd, bp = r["spy_base"]
        ed, ep = r["spy_end"]
        vd, vp = r["spy_val"]
        sr, sh = ep / bp - 1, vp / bp - 1
        ws_bm.write_datetime(i, 2, bd.to_pydatetime(), f_date)
        ws_bm.write(i, 3, bp, f_px)
        ws_bm.write_datetime(i, 4, ed.to_pydatetime(), f_date)
        ws_bm.write(i, 5, ep, f_px)
        ws_bm.write_formula(i, 6, f"=F{x}/D{x}-1", f_pct, sr)
        ws_bm.write_formula(i, 7, f"={S}{cRL}{x}", f_pct, r["real"])
        ws_bm.write_formula(i, 8, f"=H{x}-G{x}", f_pct, r["real"] - sr)
        ws_bm.write(i, 9, vp, f_px)
        ws_bm.write_formula(i, 10, f"=J{x}/D{x}-1", f_pct, sh)
        ws_bm.write_formula(i, 11, f"={S}{cHL}{x}", f_pct, r["hold"])
        ws_bm.write_formula(i, 12, f"=L{x}-K{x}", f_pct, r["hold"] - sh)
        alpha_r.append(r["real"] - sr); alpha_h.append(r["hold"] - sh); spy_r.append(sr)
    for rg in (f"G2:I{n + 1}", f"K2:M{n + 1}"):
        pct_cf(ws_bm, rg)
    ws_bm.set_column(0, 0, 8)
    ws_bm.set_column(1, 12, 15)
    ws_bm.freeze_panes(1, 1)
    ws_bm.write(n + 3, 0, "Alpha = rendimiento de la acción menos el del SPY en la misma ventana. SPY se toma desde el cierre "
                "previo a la entrada (convención de Danelfin: entrada ≈ cierre previo). Si hubo salida, el SPY se mide "
                "hasta el cierre del día de salida.", f_note)
    ch = wb.add_chart({"type": "column"})
    ch.add_series({"name": "Alpha real", "categories": [BENCH, 1, 0, n, 0], "values": [BENCH, 1, 8, n, 8],
                   "fill": {"color": "#2F5597"}, "invert_if_negative": False})
    ch.add_series({"name": "Alpha hold", "categories": [BENCH, 1, 0, n, 0], "values": [BENCH, 1, 12, n, 12],
                   "fill": {"color": "#A9B7D6"}})
    ch.set_title({"name": "Alpha vs S&P 500 (SPY)"})
    ch.set_y_axis({"num_format": "0%"})
    ch.set_x_axis({"label_position": "low"})
    ch.set_size({"width": 760, "height": 340})
    ws_bm.insert_chart(f"A{n + 6}", ch)

    # ---------- Indicadores técnicos
    ih = ["Ticker", "Momento", "Fecha del dato", "Cierre", "ADX", "+DI", "-DI", "RSI", "MFI",
          "MACD", "Señal MACD", "Hist. MACD", *[f"EMA {k}" for k in EMA_LENS],
          "Tendencia (DI)", "Fuerza (ADX)", "MACD vs señal", "Cierre vs EMA50",
          "Condiciones alcistas (0-5)", "Posición"]
    ws_ind.set_row(0, 34)
    for i, h in enumerate(ih):
        ws_ind.write(0, i, h, f_head if i < 3 or i >= 15 else f_head_op)
    ir = 1
    for r in rows:
        for s_ in r.get("snaps", []):
            q = s_["row"]
            adx, pdi, mdi, rsi, mfi, cl = q["ADX"], q["+DI"], q["-DI"], q["RSI"], q["MFI"], q["close"]
            macd, sig, e50 = q["MACD"], q["MACD_signal"], q["EMA50"]
            conds = int(cl > e50) + int(pdi > mdi) + int(rsi > 50) + int(mfi > 50) + int(macd > sig)
            fuerza = ("Sin tendencia (<20)" if adx < 20 else "Débil (20-25)" if adx < 25
                      else "Tendencia (25-40)" if adx < 40 else "Fuerte (>40)")
            vals = [r["t"], s_["label"], s_["date"].to_pydatetime(), cl, adx, pdi, mdi, rsi, mfi,
                    macd, sig, q["MACD_hist"], *[q[f"EMA{k}"] for k in EMA_LENS],
                    "Alcista (+DI>-DI)" if pdi > mdi else "Bajista (-DI>+DI)", fuerza,
                    "Alcista (MACD>señal)" if macd > sig else "Bajista (MACD<señal)",
                    "Sobre EMA50" if cl > e50 else "Bajo EMA50", conds, s_["pos"]]
            for c_, v in enumerate(vals):
                if c_ == 2:
                    ws_ind.write_datetime(ir, c_, v, f_date)
                elif 3 <= c_ <= 14:
                    ws_ind.write(ir, c_, float(v), f_px)
                elif c_ == 19:
                    ws_ind.write(ir, c_, v, f_int)
                elif c_ == 0:
                    ws_ind.write(ir, c_, v, F(border=1, bold=True))
                else:
                    ws_ind.write(ir, c_, v, f_txt)
            ir += 1
    last_i = ir
    for col in ("H", "I"):                      # RSI / MFI: sobrecompra (>=70) y sobreventa (<=30)
        rg = f"{col}2:{col}{last_i}"
        ws_ind.conditional_format(rg, {"type": "cell", "criteria": ">=", "value": 70, "format": f_amber})
        ws_ind.conditional_format(rg, {"type": "cell", "criteria": "<=", "value": 30, "format": f_blue})
    ws_ind.conditional_format(f"L2:L{last_i}", {"type": "cell", "criteria": ">", "value": 0, "format": f_green})
    ws_ind.conditional_format(f"L2:L{last_i}", {"type": "cell", "criteria": "<", "value": 0, "format": f_red})
    for col in ("P", "R", "S"):
        rg = f"{col}2:{col}{last_i}"
        ws_ind.conditional_format(rg, {"type": "text", "criteria": "begins with", "value": "Alcista", "format": f_green})
        ws_ind.conditional_format(rg, {"type": "text", "criteria": "begins with", "value": "Sobre", "format": f_green})
        ws_ind.conditional_format(rg, {"type": "text", "criteria": "begins with", "value": "Bajista", "format": f_red})
        ws_ind.conditional_format(rg, {"type": "text", "criteria": "begins with", "value": "Bajo", "format": f_red})
    ws_ind.set_column(0, 0, 8)
    ws_ind.set_column(1, 1, 24)
    ws_ind.set_column(2, 14, 11)
    ws_ind.set_column(15, 18, 21)
    ws_ind.set_column(19, 20, 14)
    ws_ind.freeze_panes(1, 2)
    ws_ind.autofilter(0, 0, ir - 1, len(ih) - 1)
    ws_ind.merge_range(ir + 1, 0, ir + 3, 12,
                       f"ADX/+DI/-DI {ADX_LEN}, RSI {RSI_LEN}, MFI {MFI_LEN}, MACD {MACD_FAST}/{MACD_SLOW}/{MACD_SIGNAL}, "
                       f"EMA {'/'.join(map(str, EMA_LENS))}. Suavizado de Wilder (RMA) sembrado con SMA para ADX y RSI. "
                       "'Al entrar' usa el cierre de la rueda anterior a la entrada (lo que se conocía al recomendar). "
                       "RSI/MFI resaltados: >=70 sobrecompra, <=30 sobreventa. Condiciones alcistas = cierre>EMA50, +DI>-DI, "
                       "RSI>50, MFI>50, MACD>señal.", f_note)

    # ---------- Notas, supuestos y gráfico (debajo de la tabla de Seguimiento)
    nrow = n + 2
    ws_seg.write(nrow, 0, f"Corte: último cierre {val_date:%d/%m/%Y} · generado {dt.datetime.now():%d/%m/%Y %H:%M}", f_sub)
    ws_seg.write(nrow + 1, 0, "Parámetros, supuestos y avisos", f_sub)
    notes = list(params_info) + [f"AVISO: {w}" for w in warnings]
    for k, ntxt in enumerate(notes):
        ws_seg.merge_range(nrow + 2 + k, 0, nrow + 2 + k, 11, ntxt, f_note)
        ws_seg.set_row(nrow + 2 + k, 28 if len(ntxt) > 130 else 15)
    ch = wb.add_chart({"type": "column"})
    ch.add_series({"name": "Real (con SL/TP)", "categories": [SEG, 1, 0, n, 0], "values": [SEG, 1, cR, n, cR],
                   "fill": {"color": "#2F5597"}, "invert_if_negative": False})
    ch.add_series({"name": "Hold (sin SL/TP)", "categories": [SEG, 1, 0, n, 0], "values": [SEG, 1, cH, n, cH],
                   "fill": {"color": "#A9B7D6"}, "invert_if_negative": False})
    ch.set_title({"name": "Rendimiento por acción: real vs hold"})
    ch.set_y_axis({"num_format": "0%", "major_gridlines": {"visible": True, "line": {"color": "#D9D9D9"}}})
    ch.set_x_axis({"label_position": "low"})
    ch.set_size({"width": 760, "height": 340})
    ws_seg.insert_chart(nrow + 3 + len(notes), 0, ch)

    # ---------- Presentación general
    for w_ in (ws_seg, ws_wk, ws_bm, ws_ind):
        w_.hide_gridlines(2)
        w_.set_zoom(90)
        w_.set_landscape()
        w_.set_paper(9)
        w_.fit_to_pages(1, 0)
    for w_ in (ws_seg, ws_bm, ws_ind):
        w_.repeat_rows(0)
    ws_seg.activate()

    wb.close()


# ============================================================ EXPORTACIÓN WEB
def _n(x, nd=4):
    if x is None:
        return None
    x = float(x)
    return None if np.isnan(x) else round(x, nd)


def _d(ts) -> str:
    return pd.Timestamp(ts).strftime("%Y-%m-%d")


def _pl(n: int, sing: str, plur: str) -> str:
    return f"{n} {sing if n == 1 else plur}"


def _pct(x: float, signo: bool = True) -> str:
    s = f"{x * 100:+.1f}%" if signo else f"{x * 100:.1f}%"
    return s.replace(".", ",").replace("-", "−")


def _leer_md(path: Path) -> str | None:
    if not path.exists():
        return None
    t = re.sub(r"<!--.*?-->", "", path.read_text(encoding="utf8"), flags=re.S).strip()
    return t or None


def resumen_web(rows) -> dict:
    done = [r for r in rows if r["real"] is not None]
    n = len(done)
    stops = [r for r in done if r["status"].startswith("Stop")]
    tps = [r for r in done if r["status"].startswith("Take")]
    abiertas = [r for r in done if r["status"] == "Abierta"]
    ganan = [r for r in done if r["real"] > 0]
    helped = sum(1 for r in stops if r["real"] > r["hold"])
    hurt = sum(1 for r in stops if r["real"] < r["hold"])
    alphas = [r["real"] - (r["spy_end"][1] / r["spy_base"][1] - 1) for r in done]
    mean = lambda v: float(np.mean(v)) if v else None
    best = max(done, key=lambda r: r["real"]) if done else None
    worst = min(done, key=lambda r: r["real"]) if done else None
    wr = mean([r["winrate"] for r in rows if r["winrate"] is not None])
    ar = mean([r["avgret"] for r in rows if r["avgret"] is not None])
    res = dict(
        n=n, stops=len(stops), takes=len(tps), abiertas=len(abiertas), ganadoras=len(ganan),
        hitRate=(len(ganan) / n) if n else None,
        realProm=mean([r["real"] for r in done]), realMed=float(np.median([r["real"] for r in done])) if n else None,
        holdProm=mean([r["hold"] for r in done]),
        mejor=dict(t=best["t"], v=best["real"]) if best else None,
        peor=dict(t=worst["t"], v=worst["real"]) if worst else None,
        stopsAyudaron=helped, stopsPerjudicaron=hurt,
        superaronSPY=sum(1 for a in alphas if a > 0), alphaProm=mean(alphas),
        winrateDanelfin=wr, avgretDanelfin=ar, probProm=mean([r["prob"] for r in rows]),
    )
    f = []
    if n:
        f.append(f"De {_pl(n, 'recomendación evaluada', 'recomendaciones evaluadas')}, "
                 f"{_pl(len(stops), 'tocó el stop loss', 'tocaron el stop loss')}, "
                 f"{_pl(len(tps), 'el take profit', 'el take profit')} y "
                 f"{_pl(len(abiertas), 'sigue abierta', 'siguen abiertas')}.")
        f.append(f"Aplicando las reglas de entrada y salida de Danelfin, {len(ganan)} de {n} están en positivo "
                 f"(hit rate {_pct(res['hitRate'], False)}). Rendimiento real promedio: {_pct(res['realProm'])}.")
        f.append(f"Sin stops (hold) el promedio habría sido {_pct(res['holdProm'])}. "
                 f"El stop ayudó en {_pl(helped, 'caso', 'casos')} y perjudicó en {_pl(hurt, 'caso', 'casos')}.")
        f.append(f"{res['superaronSPY']} de {n} superaron al S&P 500 (SPY); alpha promedio: {_pct(res['alphaProm'])}.")
        if wr is not None and ar is not None:
            f.append(f"Los mails citan un win rate histórico a 3 meses de {_pct(wr, False)} y un retorno promedio de "
                     f"{_pct(ar)}; en este seguimiento el retorno real promedio es {_pct(res['realProm'])}.")
    res["frases"] = f
    return res


def export_web(rows, data, spy, fridays, val_date, params_info, warnings, site_dir: Path, xlsx_path: Path) -> Path:
    acciones = []
    for r in rows:
        a = dict(ticker=r["t"], empresa=r["name"], fechaRec=_d(r["rec_date"]), score=r["score"], prob=r["prob"],
                 winrate=r["winrate"], avgret=r["avgret"], entrada=r["entry"], sl=r["sl"], tp=r["tp"],
                 fuente=r["source"], notas=r["notes"], estadoTexto=r["status"],
                 real=_n(r["real"]), hold=_n(r["hold"]), recupero=r["recovered"], salida=None,
                 viernes=[], serie=[], indicadores=[], fechaEntrada=None, ultimo=None,
                 spyReal=None, spyHold=None, alphaReal=None, alphaHold=None)
        if r["real"] is None:
            a["estado"] = "nueva"
            acciones.append(a)
            continue
        ex = r["exit"]
        a["estado"] = "stop" if (ex and ex["kind"] == "SL") else "take" if ex else "abierta"
        a["fechaEntrada"] = _d(r["entry_day"])
        a["ultimo"] = _n(r["last_px"], 2)
        if ex:
            a["salida"] = dict(fecha=_d(ex["date"]), precio=_n(ex["price"], 2), motivo=ex["kind"], ambiguo=ex["ambiguous"])
        bd, bp = r["spy_base"]
        spy_r = r["spy_end"][1] / bp - 1
        spy_h = r["spy_val"][1] / bp - 1
        a.update(spyReal=_n(spy_r), spyHold=_n(spy_h), alphaReal=_n(r["real"] - spy_r), alphaHold=_n(r["hold"] - spy_h),
                 spyBase=dict(fecha=_d(bd), precio=_n(bp, 2)))
        for j, f in enumerate(fridays):
            if f <= r["rec_date"]:
                continue
            p = r["fri_px"][j]
            real = (ex["price"] if ex and f >= ex["date"] else p) / r["entry"] - 1
            a["viernes"].append(dict(f=_d(f), p=_n(p, 2), real=_n(real), hold=_n(p / r["entry"] - 1),
                                     spy=_n(px_on(spy, f)[1] / bp - 1)))
        df = data[r["t"]]["df"]
        pos = df.index.get_loc(r["entry_day"])
        for d, q in df.iloc[max(0, pos - 3):].loc[:val_date].iterrows():
            a["serie"].append(dict(d=_d(d), o=_n(q["open"], 2), h=_n(q["high"], 2), l=_n(q["low"], 2), c=_n(q["close"], 2)))
        for s_ in r["snaps"]:
            q = s_["row"]
            conds = int(q["close"] > q["EMA50"]) + int(q["+DI"] > q["-DI"]) + int(q["RSI"] > 50) + \
                int(q["MFI"] > 50) + int(q["MACD"] > q["MACD_signal"])
            a["indicadores"].append(dict(
                momento=s_["label"], fecha=_d(s_["date"]), pos=s_["pos"], cierre=_n(q["close"], 2),
                adx=_n(q["ADX"], 2), pdi=_n(q["+DI"], 2), mdi=_n(q["-DI"], 2), rsi=_n(q["RSI"], 2), mfi=_n(q["MFI"], 2),
                macd=_n(q["MACD"], 3), senal=_n(q["MACD_signal"], 3), hist=_n(q["MACD_hist"], 3),
                ema20=_n(q["EMA20"], 2), ema50=_n(q["EMA50"], 2), ema200=_n(q["EMA200"], 2), conds=conds))
        acciones.append(a)

    meta = dict(
        corte=_d(val_date), generado=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        benchmark=BENCHMARK, equipo=sorted(INTEGRANTES, key=str.casefold), equipoNombre=EQUIPO_NOMBRE,
        params=dict(adx=ADX_LEN, rsi=RSI_LEN, mfi=MFI_LEN, macd=[MACD_FAST, MACD_SLOW, MACD_SIGNAL], emas=list(EMA_LENS)),
        supuestos=params_info, avisos=warnings,
        excel=dict(ruta=f"descargas/{xlsx_path.name}", kb=round(xlsx_path.stat().st_size / 1024)),
    )
    payload = dict(
        meta=meta, resumen=resumen_web(rows), acciones=acciones, viernes=[_d(f) for f in fridays],
        contenido=dict(danelfin=_leer_md(site_dir / "contenido" / "danelfin.md"),
                       conclusiones=_leer_md(site_dir / "contenido" / "conclusiones.md")),
    )
    out = site_dir / "data" / "datos.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("/* Generado por seguimiento_danelfin.py - no editar a mano */\nwindow.DATOS = "
                   + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf8")
    return out


def update_cierres(data, tickers, last_session: pd.Timestamp, path: Path) -> bool:
    """Agrega los cierres de la última rueda a data/cierres.csv (idempotente por fecha+ticker).
    Es el 'dato diario' que el workflow commitea para que el repo mantenga actividad."""
    nuevas = []
    for t in tickers:
        df = data[t]["df"]
        if last_session in df.index:
            q = df.loc[last_session]
            nuevas.append(dict(date=_d(last_session), ticker=t, open=_n(q["open"], 2), high=_n(q["high"], 2),
                               low=_n(q["low"], 2), close=_n(q["close"], 2), volume=int(q["volume"])))
    if not nuevas:
        return False
    cols = ["date", "ticker", "open", "high", "low", "close", "volume"]
    new = pd.DataFrame(nuevas, columns=cols)
    path.parent.mkdir(parents=True, exist_ok=True)
    old = pd.read_csv(path, dtype={"date": str}) if path.exists() else pd.DataFrame(columns=cols)
    merged = pd.concat([old, new]).drop_duplicates(subset=["date", "ticker"], keep="last") \
        .sort_values(["date", "ticker"]).reset_index(drop=True)
    txt = merged.to_csv(index=False, lineterminator="\n").encode("utf8")
    if path.exists() and path.read_bytes() == txt:
        return False
    path.write_bytes(txt)
    return True


# ==================================================================== MAIN
def main() -> None:
    ap = argparse.ArgumentParser(description="Seguimiento Danelfin AI -> Excel + datos de la web")
    ap.add_argument("--end", help="fecha de corte YYYY-MM-DD (por defecto hoy)")
    ap.add_argument("--corte", choices=["ultima-rueda", "ultimo-viernes"], default="ultima-rueda",
                    help="a qué fecha se valúan las posiciones (por defecto: última rueda cerrada)")
    ap.add_argument("--recs", default=str(RECS_CSV), help="CSV de recomendaciones")
    ap.add_argument("--importar-eml", metavar="CARPETA", help="agrega los .eml de la carpeta a recomendaciones.csv y sale")
    ap.add_argument("--refresh", action="store_true", help="ignorar caché")
    ap.add_argument("--verify", action="store_true", help="contrastar yfinance contra Massive")
    ap.add_argument("--debug-indicators", metavar="TICKER", help="imprimir indicadores y salir")
    ap.add_argument("--out", help="ruta del .xlsx de salida")
    ap.add_argument("--site-dir", default=str(SITE_DIR), help="carpeta de la web")
    ap.add_argument("--sin-cierres", action="store_true", help="no actualizar data/cierres.csv")
    args = ap.parse_args()

    recs_path = Path(args.recs)
    if args.importar_eml:
        importar_eml(Path(args.importar_eml), recs_path)
        return

    env = load_env()
    key = os.environ.get("MASSIVE_API_KEY") or env.get("MASSIVE_API_KEY")
    end = pd.Timestamp(args.end) if args.end else today_et()
    warnings: list[str] = []

    log("1/5 Leyendo recomendaciones ...")
    recs = load_recs(recs_path)
    log(f"    {len(recs)} recomendaciones: " + ", ".join(f"{r['t']} ({r['rec_date']:%d/%m})" for r in recs))

    log("2/5 Descargando precios ...")
    start = min(r["rec_date"] for r in recs) - pd.Timedelta(days=HISTORY_DAYS)
    tickers = sorted({r["t"] for r in recs} | {BENCHMARK})
    data = {}
    for t in tickers:
        df, src = get_ohlcv(t, start, end, args.refresh, key, warnings)
        data[t] = dict(df=df, src=src, ind=indicators(df))
        log(f"    {t:5s} {len(df):4d} ruedas hasta {df.index.max():%d/%m/%Y}  [{src}]")
        if args.verify:
            verify_sources(t, df.loc[min(r["rec_date"] for r in recs):], key, warnings)

    if args.debug_indicators:
        t = args.debug_indicators.upper()
        pd.set_option("display.width", 200)
        print(data[t]["ind"].tail(8).round(2))
        return

    spy = data[BENCHMARK]["df"]
    last_data = min(spy.index.max(), end)
    first = min(r["rec_date"] for r in recs)
    f = first + pd.Timedelta(days=(4 - first.weekday()) % 7)
    fridays = []
    while f <= last_data:
        fridays.append(f)
        f += pd.Timedelta(days=7)
    val_date = fridays[-1] if (args.corte == "ultimo-viernes" and fridays) else last_data
    for t in tickers:       # un feriado se resuelve con la última rueda previa; avisar si falta dato
        if data[t]["df"].index.max() < val_date:
            warnings.append(f"{t}: sin datos al {val_date:%d/%m/%Y} (último {data[t]['df'].index.max():%d/%m/%Y})")

    log(f"3/5 Evaluando SL/TP y rendimientos (corte: {val_date:%d/%m/%Y}, {len(fridays)} viernes) ...")
    rows = build(recs, {t: data[t] for t in tickers}, spy, fridays, val_date, warnings)

    log("4/5 Resultados:")
    log(f"    {'Tick':5s} {'Rec':>6s} {'Entrada':>9s} {'Estado':<20s} {'Salida':>8s} {'Real':>8s} {'Hold':>8s}")
    for r in rows:
        ex = r["exit"]
        log(f"    {r['t']:5s} {r['rec_date']:%d/%m} {r['entry']:9.2f} {r['status']:<20s} "
            f"{(ex['date'].strftime('%d/%m') if ex else '-'):>8s} "
            f"{(f'{r['real']:+.1%}' if r['real'] is not None else '-'):>8s} "
            f"{(f'{r['hold']:+.1%}' if r['hold'] is not None else '-'):>8s}")

    params_info = [
        "Fuentes de precios: yfinance (principal, cierres sin ajustar por dividendos) y Massive (respaldo).",
        "Entrada = 'Entry price' del mail de Danelfin. SL/TP = niveles del mail. Se evalúa desde la rueda de la recomendación con "
        "máximos y mínimos diarios (toque intradía, aunque el cierre recupere). Salida al nivel; si abre con gap más allá del nivel, a la apertura.",
        "Si SL y TP se tocan el mismo día se asume SL (lectura conservadora) y se avisa. La condición 'o AI Score' de los mails no se "
        "evalúa (no hay scores diarios).",
        "Rendimiento real: se congela en el precio de salida. Hold: último cierre / entrada, sin aplicar SL/TP. "
        f"Las posiciones abiertas se valúan al último cierre disponible ({val_date:%d/%m/%Y}).",
        f"Indicadores: ADX/+DI/-DI {ADX_LEN}, RSI {RSI_LEN}, MFI {MFI_LEN}, MACD {MACD_FAST}/{MACD_SLOW}/{MACD_SIGNAL}, "
        f"EMA {'/'.join(map(str, EMA_LENS))}; Wilder (RMA) sembrado con SMA. 'Al entrar' usa el cierre de la rueda previa.",
        "Benchmark: SPY desde el cierre previo a la entrada. Pocos casos en un solo trimestre: las conclusiones son ilustrativas, "
        "no inferencia estadística. Trabajo académico: no constituye asesoramiento de inversión.",
    ]

    log("5/5 Escribiendo Excel y datos de la web ...")
    out = Path(args.out) if args.out else OUT_XLSX
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        CACHE_DIR.mkdir(exist_ok=True)
        shutil.copy2(out, CACHE_DIR / f"{out.stem}.previo.xlsx")
    try:
        write_excel(rows, fridays, val_date, params_info, warnings, out)
    except PermissionError:
        sys.exit(f"ERROR: no se puede escribir {out}. ¿Está abierto en Excel? Cerralo y volvé a correr.")
    log(f"    Excel -> {out}")
    site = Path(args.site_dir)
    datos = export_web(rows, data, spy, fridays, val_date, params_info, warnings, site, out)
    log(f"    Web   -> {datos}")
    if not args.sin_cierres:
        cambio = update_cierres(data, tickers, last_data, CIERRES_CSV)
        log(f"    Cierres {last_data:%d/%m/%Y} -> {CIERRES_CSV.relative_to(BASE)} ({'actualizado' if cambio else 'sin cambios'})")
    if warnings:
        log("\nAVISOS:")
        for w in warnings:
            log("  - " + w)


if __name__ == "__main__":
    main()
