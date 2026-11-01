#!/usr/bin/env bash
# dayflow 안드로이드 앱 만들기 (GitHub Actions에서 실행)
# 저장소 루트에서: bash android/setup.sh <빌드번호> [route]
#   두 번째 값이 route 이면 동선만 보이는 "dayflow 동선" 앱을 따로 만들어요 (app-build-route)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NUM="${1:-1}"
APP="${2:-main}"
if [ "$APP" = "route" ]; then
  BUILD="$ROOT/app-build-route"; APP_ID="com.seoa930309.dayflow.route"; APP_NAME="dayflow 동선"
else
  BUILD="$ROOT/app-build"; APP_ID="com.seoa930309.dayflow"; APP_NAME="dayflow"
fi

rm -rf "$BUILD" && mkdir -p "$BUILD/www"
# 1) 웹 앱 파일 (GitHub 사이트와 같은 파일)
cp "$ROOT/index.html" "$ROOT/manifest.webmanifest" "$BUILD/www/"
cp -r "$ROOT/fonts" "$ROOT/icons" "$BUILD/www/"
if [ "$APP" = "route" ]; then
  # 동선 전용 모드를 켜는 한 줄을 <head> 맨 앞에 넣어요
  python3 - "$BUILD/www/index.html" <<'PY'
import sys
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
assert s.count('<head>') == 1
s = s.replace('<head>', '<head>\n<script>window.DAYFLOW_ROUTE_ONLY = 1;</script>', 1)
open(p, 'w', encoding='utf-8').write(s)
print('동선 전용 모드 켬')
PY
fi

# 2) Capacitor로 안드로이드 프로젝트 만들기
cd "$BUILD"
npm init -y >/dev/null
npm install --no-audit --no-fund @capacitor/core@6 @capacitor/cli@6 @capacitor/android@6
npx cap init "$APP_NAME" "$APP_ID" --web-dir www
npx cap add android

# 3) 아이콘 · 시작 화면
RES="$BUILD/android/app/src/main/res"
find "$RES" -name 'splash.png' -delete
cp -r "$ROOT/android/res/." "$RES/"
[ "$APP" = "route" ] && cp -r "$ROOT/android/res-route/." "$RES/"

# 3-1) 홈 화면 위젯 (오늘 할 일 · 오전/오후/밤 · 매트릭스) — 본 앱에만
if [ "$APP" != "route" ]; then
JAVA="$BUILD/android/app/src/main/java/com/seoa930309/dayflow"
mkdir -p "$JAVA"
cp "$ROOT"/android/widget/java/*.java "$JAVA/"
cp -r "$ROOT/android/widget/res/." "$RES/"
python3 - "$BUILD/android/app/src/main/AndroidManifest.xml" <<'PY'
import sys
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
def rcv(cls, label, info):
    return f'''
        <receiver android:name=".{cls}" android:exported="false" android:label="@string/{label}">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/{info}" />
        </receiver>'''
add = rcv('TodayWidget', 'w_today_label', 'widget_today_info') + rcv('SlotsWidget', 'w_slots_label', 'widget_slots_info') + rcv('MatrixWidget', 'w_matrix_label', 'widget_matrix_info')
# 위젯 안 스크롤 목록
add += '''
        <service android:name=".WidgetListService" android:permission="android.permission.BIND_REMOTEVIEWS" android:exported="false" />'''
assert s.count('</application>') == 1
s = s.replace('</application>', add + '\n    </application>')
open(p, 'w', encoding='utf-8').write(s)
print('위젯 등록 완료')
PY
fi

# 4) 서명(항상 같은 열쇠 → 새 버전을 덮어 설치해도 데이터 유지) + 버전 번호
cp "$ROOT/android/dayflow.keystore" "$BUILD/android/app/dayflow.keystore"
cat >> "$BUILD/android/app/build.gradle" <<GRADLE

android {
    defaultConfig {
        versionCode ${NUM}
        versionName "1.${NUM}"
    }
    signingConfigs {
        dayflow {
            storeFile file('dayflow.keystore')
            storePassword 'dayflow'
            keyAlias 'dayflow'
            keyPassword 'dayflow'
        }
    }
    buildTypes {
        release { signingConfig signingConfigs.dayflow }
    }
}
GRADLE
