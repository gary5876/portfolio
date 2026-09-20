---
layout: post
published: false
title: "Grafana 알림이 서버가 아니라 설정 때문에 울리고 있었습니다"
date: 2026-02-28 09:00:00 +0900
categories: [troubleshooting]
tags: [team18-be, monitoring, grafana, prometheus]
description: "모니터링을 올린 뒤 알림 규칙 여덟 개가 전부 오발화하던 원인과, 대시보드 호환과 무데이터 알림까지 손본 기록"
---

안녕하세요, 고준서입니다. 동아리움이라는 대학 동아리 지원 서비스의 백엔드를 팀에서 맡고 있고(백엔드 3인, 프론트엔드 3인), 서버 모니터링은 제가 붙였습니다. 2026년 2월에 Prometheus, Grafana, Loki로 모니터링을 올렸는데, 올리고 나서 첫 3주는 알림이 서버 상태가 아니라 설정 때문에 울렸어요. 알림 규칙 여덟 개가 데이터 소스를 이름으로 찾고 있었는데 Grafana는 고유 식별자(UID)로 찾아서, 서버가 멀쩡한데도 여덟 개가 전부 "데이터 소스 오류"로 울린 겁니다.

이 글은 무엇을 붙였는지, 규칙 여덟 개의 값이 무엇이었는지, 왜 전부 울렸고 어떻게 고쳤는지를 PR 번호와 설정 변경으로 적습니다. 그 3주 동안 알림이 몇 건 왔는지, 누가 언제 이상하다고 알아챘는지, 처음에 무엇을 의심했는지는 기록에 없어요. 원인은 PR 본문에 적은 문장이 전부이고, 임계값을 그 숫자로 잡은 이유도 어디에도 적혀 있지 않습니다.

## 붙인 것

1월 24일에 [이슈 #281](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/issues/281)로 계획을 올렸습니다. 서버 지표(CPU, 메모리, HTTP 요청)를 Prometheus가 모으고, Grafana가 그려 주고, 로그는 Loki에 모아 검색할 수 있게 하고, 임계값을 넘으면 알림을 보내는 구성이에요. 2월 2일 커밋([b44963c2](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/commit/b44963c2)) 하나에 2,968줄이 들어갔고, [PR #286](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/286)으로 8일에 머지됐습니다. 대시보드는 JVM, HTTP, System, Business 네 장, 알림 규칙은 여덟 개(CPU, 힙 메모리, 5xx 비율, P95 응답 시간, GC 정지 시간, 스레드 수, DB 커넥션 풀 대기, 앱 다운)이고 알림은 Discord 채널로 갑니다. PR 본문의 고민한 내용은 이랬습니다.

> - Actuator 엔드포인트 보안 설정 (health, prometheus만 public 허용)
> - 대시보드별 메트릭 분류 기준 (JVM/HTTP/System/Business)
> - 알림 임계값 설정 기준

세 번째 줄의 임계값은 첫 커밋 기준으로 이랬습니다. CPU 90%(5분), 힙 메모리 85%(5분), 5xx 비율 5%(3분), P95 응답 시간 1초(5분), GC 정지 초당 500ms(5분), 스레드 500개(5분), DB 커넥션 대기 5개(3분)이고, 앱 다운은 수집 실패가 1분 이어지면 울립니다. 규칙 파일의 주석은 시스템 자원 규칙을 USE 방법, HTTP 규칙을 RED 방법으로 묶었다고 밝히는데, 각각 자원을 보는 관점과 요청을 보는 관점으로 알려진 분류예요. 다만 값을 그 숫자로 잡은 이유와 그때 트래픽을 본 기록은 없습니다.

`monitoring/` 폴더의 설정은 6천여 줄인데 55줄을 빼고 제가 썼습니다. 팀원이 승인하면서 남긴 말이 있어요.

> 솔직히 코드 봐서는 어떤건지 잘 모르겠는데 수고 많으셨습니다!!
> 그럼 로그 수집을 loki가 해주는건가? 따로 대쉬보드가 있는거야 아니면 그냥수집만 해주는거야?
> 에러 로그를 수집해준다는건가?

이 질문에 그 자리에서 답을 남기진 않았습니다. Loki는 로그를 모아 두는 저장소이고 Grafana에서 검색해서 보는 구조라, 별도 대시보드는 없고 오류 로그도 같은 곳에 쌓입니다.

## 알림 규칙 여덟 개가 전부 오발화했습니다

2월 24일에 [PR #302](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/302)를 올렸습니다. PR 본문의 고민한 내용 칸에 원인을 이렇게 적었어요.

> Grafana는 alert rule에서 datasource를 UID로 찾는데, 기존 코드가 UID 대신 이름(`Prometheus`)을 사용하고 있었음. datasource에 명시적 uid를 지정하지 않으면 Grafana가 자동 생성한 UID와 불일치 발생 → 모든 alert rule이 `DatasourceError`로 오발화

Grafana에서 알림 규칙은 "어느 데이터 소스에 물어볼지"를 UID라는 고유 식별자로 찾습니다. 그런데 규칙 파일에는 UID 자리에 데이터 소스 이름 `Prometheus`를 적어 두었고, 데이터 소스 쪽엔 UID를 따로 정하지 않아서 Grafana가 임의의 값을 만들어 붙였어요. 둘이 맞을 리가 없으니 규칙 여덟 개가 전부 "데이터 소스 오류" 상태가 됐고, 그 상태도 알림으로 나갑니다. 서버는 멀쩡한데 CPU도 힙도 앱 다운도 다 울린 거예요.

수정은 두 곳입니다. 데이터 소스에 UID를 직접 정하고, 규칙 여덟 개가 그 UID를 가리키게 했습니다.

```yaml
# monitoring/grafana/provisioning/datasources/datasources.yml (03c9f423)
 datasources:
   - name: Prometheus
+    uid: prometheus-datasource
     type: prometheus
```

```yaml
# monitoring/grafana/provisioning/alerting/alerting.yml (03c9f423, 여덟 규칙 전부 같은 변경)
-            datasourceUid: Prometheus
+            datasourceUid: prometheus-datasource
```

같은 PR에서 알림에 붙는 링크가 `localhost:3000`으로 나가던 것도 고쳤습니다. Discord로 온 알림을 눌러도 아무 데도 안 가는 링크였는데, Grafana에 외부 주소(`GF_SERVER_ROOT_URL`)를 알려줘서 `https://monitor.dongarium.co.kr`로 가게 했어요. 25일에 머지됐고, 28일에 올린 [PR #307](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/307)에도 같은 UID 수정이 한 번 더 들어갔습니다.

## 28일 하루에 세 번 더

같은 날 대시보드 하나를 더 붙이려다 두 번 되돌렸습니다. Grafana 커뮤니티 대시보드(번호 11378) "Spring Boot 2.1 System Monitor"를 그대로 가져와 올렸는데([PR #308](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/308), 3,781줄), Grafana 6 시절 형식이라 지금 쓰는 Grafana 10.2에서 안 맞았어요. 커밋 [309e6c5c](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/commit/309e6c5c)로 지우고, Grafana에서 데이터 소스를 연결한 상태로 다시 내보낸 JSON을 [PR #310](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/310)으로 올렸습니다. PR에 적은 건 "datasource연결 후 json 받아서 수정" 한 줄이에요.

밤에는 [PR #311](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/311)로 HTTP 알림 두 개의 설정을 바꿨습니다.

```yaml
# monitoring/grafana/provisioning/alerting/alerting.yml (b2dff7df, 5xx 비율과 P95 응답 시간 규칙)
-        noDataState: NoData
+        noDataState: OK
```

`noDataState`는 규칙이 볼 데이터가 아예 없을 때 어떤 상태로 둘지 정하는 값입니다. 5xx 비율이나 P95 응답 시간은 요청이 있어야 계산되는데, 새벽처럼 요청이 없는 시간엔 데이터가 없어요. 그걸 `NoData`로 두면 "데이터 없음"이 알림으로 나가고, `OK`로 두면 조용합니다. CPU나 힙처럼 항상 값이 있는 규칙은 `NoData`로 뒀고, 앱 다운 규칙은 데이터가 없는 것 자체가 문제라 `Alerting`으로 뒀습니다. PR 본문에는 이유를 안 적었는데, 설정의 뜻은 그렇습니다.

## 마치며

이 알림 설정은 일곱 달 뒤에 제 몫을 했습니다. 9월에 "DB 커넥션 풀 고갈" 알림이 반복해서 왔는데 코드가 아니라 Loki 로그 파일이 디스크를 채운 게 원인이었고, 그건 다른 글에서 다루겠습니다. 그리고 8월에 PR #286에 뒤늦게 코멘트가 하나 달렸어요.

> 이미 머지가 되긴 했지만... 실무에서는 레코딩룰을 많이 활용하는 편입니다!

레코딩 룰은 자주 쓰는 계산식을 Prometheus가 미리 계산해 두게 하는 기능인데, 저는 규칙마다 원본 식을 그대로 넣어 두었습니다. 아직 바꾸지 않았고, 다음에 규칙을 손댈 때 같이 볼 생각입니다.

이 3주에서 기록으로 남은 사실은 이렇습니다.

1. 규칙 여덟 개의 임계값은 위에 적은 대로입니다. 그 값을 정한 근거는 남아 있지 않습니다.
2. 3주 동안 온 알림 건수와 발견 경위는 기록에 없고, 원인은 PR #302 본문의 문장이 전부입니다.
3. 같은 UID 수정이 #302와 #307에 두 번 들어갔습니다. 첫 수정이 왜 모자랐는지는 PR에 적혀 있지 않습니다.
