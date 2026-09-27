package com.seoa930309.dayflow;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StrikethroughSpan;
import android.text.style.StyleSpan;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/** 앱(웹)이 넘겨준 요약(JSON)을 저장해 두고 위젯이 읽어요. */
final class WidgetData {
    static final String PREFS = "dayflow_widget";
    static final String KEY = "snapshot";
    static final String VIEW_KEY = "open_view";
    static final String EXTRA_VIEW = "dayflow_view";
    static final String PENDING_KEY = "pending";
    private static final String[] DOW = {"일", "월", "화", "수", "목", "금", "토"};
    private static final int FLAGS = Spanned.SPAN_EXCLUSIVE_EXCLUSIVE;

    private WidgetData() {}

    static JSONObject root(Context c) {
        try {
            String s = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
            return s == null ? null : new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
    }

    static String todayLabel() {
        Calendar c = Calendar.getInstance();
        return (c.get(Calendar.MONTH) + 1) + "/" + c.get(Calendar.DAY_OF_MONTH)
                + " (" + DOW[c.get(Calendar.DAY_OF_WEEK) - 1] + ")";
    }

    /** 오늘 날짜의 요약. 앱을 한 번도 열지 않았으면 null */
    static JSONObject today(JSONObject root) {
        if (root == null) return null;
        JSONObject days = root.optJSONObject("days");
        if (days == null) return null;
        JSONObject d = days.optJSONObject(todayKey());
        if (d != null) return d;
        // 앱이 넘겨준 범위 밖(오래 안 열었을 때)이면 빈 날로
        return new JSONObject();
    }

    static CharSequence todoLine(JSONObject t, int muted) {
        SpannableStringBuilder b = new SpannableStringBuilder();
        boolean done = t.optBoolean("d");
        b.append(done ? "✓  " : "○  ");
        b.setSpan(new ForegroundColorSpan(muted), 0, b.length(), FLAGS);
        String ab = t.optString("s", "");
        if (ab.length() > 0) {
            int st = b.length();
            b.append(ab);
            int col = muted;
            try {
                String c = t.optString("c", "");
                if (c.startsWith("#")) col = Color.parseColor(c);
            } catch (Exception ignored) { }
            b.setSpan(new ForegroundColorSpan(col), st, b.length(), FLAGS);
            b.setSpan(new StyleSpan(Typeface.BOLD), st, b.length(), FLAGS);
            b.append(' ');
        }
        int st = b.length();
        b.append(t.optString("n", ""));
        if (done) {
            b.setSpan(new StrikethroughSpan(), st, b.length(), FLAGS);
            b.setSpan(new ForegroundColorSpan(muted), st, b.length(), FLAGS);
        }
        return b;
    }

    static CharSequence eventLine(JSONObject e, int muted) {
        SpannableStringBuilder b = new SpannableStringBuilder();
        String tm = e.optString("t", "");
        b.append(tm.length() > 0 ? tm : "일정");
        b.setSpan(new StyleSpan(Typeface.BOLD), 0, b.length(), FLAGS);
        b.append("  ");
        b.append(e.optString("n", ""));
        return b;
    }

    static CharSequence muted(String s, int muted) {
        SpannableStringBuilder b = new SpannableStringBuilder(s);
        b.setSpan(new ForegroundColorSpan(muted), 0, b.length(), FLAGS);
        return b;
    }

    /** 위젯에서 체크: 요약의 완료 표시를 바로 바꾸고, 앱이 열릴 때 가져갈 목록에 적어 둬요 */
    static void toggle(Context c, String id) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject root = root(c);
        if (root == null) return;
        JSONObject days = root.optJSONObject("days");
        if (days == null) return;
        try {
            Boolean cur = find(days.optJSONObject(todayKey()), id);
            Iterator<String> it = days.keys();
            while (cur == null && it.hasNext()) cur = find(days.optJSONObject(it.next()), id);
            if (cur == null) return;
            boolean nd = !cur;
            it = days.keys();
            while (it.hasNext()) {
                JSONObject d = days.optJSONObject(it.next());
                JSONArray a = d == null ? null : d.optJSONArray("td");
                if (a == null) continue;
                for (int i = 0; i < a.length(); i++) {
                    JSONObject t = a.optJSONObject(i);
                    if (t != null && id.equals(t.optString("id"))) t.put("d", nd);
                }
            }
            JSONObject pend = new JSONObject(p.getString(PENDING_KEY, "{}"));
            pend.put(id, nd);
            p.edit().putString(KEY, root.toString()).putString(PENDING_KEY, pend.toString()).apply();
        } catch (Exception ignored) { }
    }

    private static Boolean find(JSONObject day, String id) {
        JSONArray a = day == null ? null : day.optJSONArray("td");
        if (a == null) return null;
        for (int i = 0; i < a.length(); i++) {
            JSONObject t = a.optJSONObject(i);
            if (t != null && id.equals(t.optString("id"))) return t.optBoolean("d");
        }
        return null;
    }

    /** 위젯에서 체크한 것들 {id: 완료여부} — 한 번 가져가면 지워요 */
    static JSONObject takePending(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String s = p.getString(PENDING_KEY, "{}");
        p.edit().remove(PENDING_KEY).apply();
        try { return new JSONObject(s); } catch (Exception e) { return new JSONObject(); }
    }

    /** 앱이 새 요약을 넘길 때, 아직 앱이 가져가지 않은 위젯 체크를 덮어쓰지 않게 다시 적용해요 */
    static String keepPending(Context c, String json) {
        try {
            JSONObject pend = new JSONObject(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PENDING_KEY, "{}"));
            if (pend.length() == 0) return json;
            JSONObject root = new JSONObject(json);
            JSONObject days = root.optJSONObject("days");
            if (days == null) return json;
            Iterator<String> it = days.keys();
            while (it.hasNext()) {
                JSONObject d = days.optJSONObject(it.next());
                JSONArray a = d == null ? null : d.optJSONArray("td");
                if (a == null) continue;
                for (int i = 0; i < a.length(); i++) {
                    JSONObject t = a.optJSONObject(i);
                    if (t != null && pend.has(t.optString("id"))) t.put("d", pend.optBoolean(t.optString("id")));
                }
            }
            return root.toString();
        } catch (Exception e) {
            return json;
        }
    }

    static int parseColor(String hex, int fallback) {
        try { if (hex != null && hex.startsWith("#")) return Color.parseColor(hex); } catch (Exception ignored) { }
        return fallback;
    }

    /** 배경색에 맞춘 글자색 (밝은 배경 → 검정, 어두운 배경 → 흰색) */
    static int textOn(int bg) {
        int y = (Color.red(bg) * 299 + Color.green(bg) * 587 + Color.blue(bg) * 114) / 1000;
        return y >= 150 ? 0xFF1A1A1A : 0xFFFFFFFF;
    }

    static int soft(int fg) { return (fg & 0x00FFFFFF) | 0xB0000000; }

    /** 저장된 요약이 바뀌면 붙어 있는 위젯을 모두 다시 그려요 */
    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        Class<?>[] kinds = {TodayWidget.class, SlotsWidget.class, MatrixWidget.class};
        for (Class<?> k : kinds) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
            if (ids == null || ids.length == 0) continue;
            Intent i = new Intent(c, k);
            i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            c.sendBroadcast(i);
        }
    }
}
