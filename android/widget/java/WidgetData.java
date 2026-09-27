package com.seoa930309.dayflow;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StrikethroughSpan;
import android.text.style.StyleSpan;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/** 앱(웹)이 넘겨준 요약(JSON)을 저장해 두고 위젯이 읽어요. */
final class WidgetData {
    static final String PREFS = "dayflow_widget";
    static final String KEY = "snapshot";
    static final String VIEW_KEY = "open_view";
    static final String EXTRA_VIEW = "dayflow_view";
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
