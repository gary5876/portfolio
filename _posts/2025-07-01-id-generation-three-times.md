---
layout: post
title: "멘토의 질문 하나가 ID 발번 코드를 세 번 바꿨다: long++, AtomicLong, KeyHolder"
date: 2025-07-01 09:00:00 +0900
categories: [study]
tags: [kakao-tech-campus, code-review, spring-boot, jdbc]
---

카카오테크캠퍼스 3기 백엔드 과정의 첫 미션(spring-gift-product)은 개인 과제였다. 2025년 6월 24일부터 7월 1일까지 상품 API를 만들고 관리자 화면을 붙이고 DB를 연결하는 세 단계였고, 단계마다 멘토가 PR을 리뷰했다. 그 일주일 동안 상품 ID를 만드는 코드가 세 번 바뀌었는데, 세 번 다 내가 먼저 문제를 본 게 아니라 멘토의 질문이 먼저였다. 그 질문과 답변, 그리고 코드가 어떻게 움직였는지를 적는다.

**1단계: 컨트롤러 필드에 long을 두고 ++**

2단계 PR([#166](https://github.com/next-step/spring-gift-product/pull/166), 6월 26일)에서 관리자 화면의 상품 저장소는 컨트롤러 안의 `LinkedHashMap`이었고, ID는 필드 하나를 올려 가며 붙였다.

```java
// src/main/java/gift/Controller/AdminProductController.java:14-15, 31 (10371a6)
    private final Map<Long, Product> productMap = new LinkedHashMap<>();
    private long nextId = 1;

        product.setId(nextId++);
```

요구사항은 만족했다. 화면에서 상품을 만들면 1, 2, 3이 붙었다. 다음 날 멘토가 15번째 줄에 코멘트를 달았다.

> Java에서 volatile, synchronized, AtomicLong 는 어떤 기능들일까요?
> 현재 코드로 ID를 발번하면 어떤 문제가 있을지 생각한번 해보면 좋을것 같아요

고치라는 말이 아니라 물음이었다. 답을 쓰려면 세 키워드를 찾아봐야 했고, 찾아보니 문제가 보였다. 컨트롤러는 싱글턴이고 요청은 여러 스레드에서 들어오는데, `nextId++`는 읽고 더하고 쓰는 세 동작이라 두 요청이 겹치면 같은 ID를 두 번 줄 수 있다. 그날 밤 답글을 달았다.

> long과 ++ 사용으로인해 결국 멀티쓰레드 환경에서 중복된 ID 생성이 되고, 그게 아무런 제한장치없이 사용될 수 있네요
> volatile은 메모리에 저장을 해 중복발생을 줄이지만, 여전히 같은 이유로 중복발생가능
> synchronized는 락으로 중복발생을 막는다. 하지만 데드락이 발생할 수 도 있음
> AtomicLong은 CAS(compare and swap)알고리즘을 통해 중복발생방지를 보장함
> 이런 사항들을 고려해보니 일단 AtomicLong을 사용하는게 적합해보여서 수정했습니다.

**2단계: AtomicLong, 그리고 저장소 분리**

같은 리뷰에서 "Admin과 Product의 HashMap이 서로 다르네요, 이제는 저장소 코드를 분리해야할때가 된것 같아요"라는 코멘트도 받았다. 두 지적을 한 커밋([f5f9998](https://github.com/next-step/spring-gift-product/commit/f5f9998), 6월 27일 21시 21분)으로 처리했다. 컨트롤러에 흩어져 있던 맵을 `ProductRepository`로 모으고, 발번은 `AtomicLong`에 맡겼다.

```java
// src/main/java/gift/Repository/ProductRepository.java:12-13, 17 (f5f9998)
    private final Map<Long, Product> storage = new LinkedHashMap<>();
    private final AtomicLong nextId = new AtomicLong(1);

            product.setId(nextId.getAndIncrement());
```

멘토는 "네네 여러가지 부분에 대해서 잘고민해주셨네요!"라고 남기고 다음 날 머지했다. 여기서 끝났다고 생각했다.

**3단계: DB로 옮기자 같은 질문이 다시 왔다**

3단계는 H2에 JDBC로 붙이는 과제였다. 6월 30일 아침 커밋([178d709](https://github.com/next-step/spring-gift-product/commit/178d709))에서 `AtomicLong`은 주석이 됐고, 저장은 INSERT 뒤에 가장 큰 id를 읽어 오는 방식이 됐다.

```java
// src/main/java/gift/Repository/ProductRepository.java:39-43 (178d709)
    public Product save(Product product) {
        if(product.getId() == null){
            jdbcTemplate.update("Insert into products (name, price, imgUrl) values (?, ?, ?)", product.getName(), product.getPrice(), product.getImgUrl());
            Long id = jdbcTemplate.queryForObject("select max(id) from products", Long.class);
            product.setId(id);
```

발번 자체는 DB의 auto increment가 하니 중복은 없다. 그런데 방금 넣은 행의 ID를 알아내는 방법이 `max(id)`였다. PR([#239](https://github.com/next-step/spring-gift-product/pull/239))을 올린 지 두 시간 만에 멘토가 39번째 줄에 물었다.

> save가 동시에 여러개의 스레드에서 호출되었을때 동시성 이슈는 없을까요?
> select max(id)가 자신이 방금 삽입한 로우의 ID라는걸 보장할 수 있을까요?

2단계에서 배운 것과 정확히 같은 계열의 문제였다. 내 INSERT와 내 SELECT 사이에 다른 요청의 INSERT가 끼어들면, 나는 남의 ID를 내 상품에 붙이게 된다. 발번을 DB로 넘겼다고 동시성 문제가 사라진 게 아니라, 자리를 옮겼을 뿐이었다. 그날 저녁 커밋([3641f99](https://github.com/next-step/spring-gift-product/commit/3641f99), 18시 9분)에서 `save`를 `create`와 `update`로 나누고, `create`는 JDBC가 돌려주는 생성 키를 받게 했다.

```java
// src/main/java/gift/Repository/ProductRepository.java:52-66 (3641f99)
    public Product create(Product product) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO products (name, price, imgUrl) VALUES (?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, product.getName());
            ps.setInt(2, product.getPrice());
            ps.setString(3, product.getImgUrl());
            return ps;
        }, keyHolder);

        Long id = keyHolder.getKey().longValue();
        product.setId(id);
```

PR에 남긴 설명은 한 줄이었다.

> 해당 스레드에서 생성한 ID임을 보장하기위해 keyholder를 사용하였습니다.

다음 날 멘토가 53번째 줄에 "넵 이방식이면 삽입한 ID를 알수있겠네요 👍 👍"를 남기고 머지했다.

**남은 것: 주석 처리된 max(id)**

여기까지만 쓰면 깔끔한데, 최종 코드에는 `select max(id)`가 아직 있다. 실행되는 경로는 아니다. 옛 `save` 메서드를 지우지 않고 `/* */`로 감싸 둔 채 머지했고, 그 블록 안의 39번째 줄에 `max(id)`가 그대로 남아 있다. 고친 뒤에도 옛 코드를 지우지 못하는 습관이 이때부터였다. 같은 PR에서 "필드와 생성자 사이 개행", "매퍼는 `private static final`로", "가격은 int 말고 다른 타입"(decimal로 바꿨다) 같은 지적도 같이 받았는데, 죽은 코드를 지우라는 말은 없었고 나도 지우지 않았다.

**이 대화에서 배운 것**

세 코드는 전부 요구사항을 통과했다. 화면에서 상품을 만들면 ID가 붙었고 테스트도 돌았다. 차이는 조건이 바뀌었을 때 드러난다. 요청이 하나일 때 맞는 코드와 요청이 겹칠 때도 맞는 코드는 다르고, 발번을 메모리에서 DB로 옮기면 문제의 위치도 같이 옮겨 간다. 멘토는 두 번 다 답을 주지 않고 "이러면 어떤 문제가 있을까요"만 물었고, 두 번째 질문을 받았을 때 첫 번째 답을 내가 스스로 적용하지 못했다는 걸 알았다. 배운 것을 안다는 것과 새 상황에서 알아본다는 것 사이의 거리가 그 이틀이었다.

**지금 다시 본다면**

2단계 코드는 `AtomicLong`으로 ID 중복만 막았지 `LinkedHashMap` 자체는 동기화되지 않았다. 두 스레드가 동시에 `put`을 하면 맵이 깨질 수 있는데, 그때는 ID에만 눈이 가 있어서 저장소 전체가 같은 조건에 놓여 있다는 걸 못 봤고 멘토도 거기까지는 묻지 않았다. 3단계의 `KeyHolder`는 맞는 답이지만 JPA로 넘어가면 `@GeneratedValue`가 같은 일을 대신하고, 그다음 미션부터는 이 코드를 다시 쓸 일이 없었다. 남은 건 코드가 아니라 "이 코드는 요청이 겹칠 때도 맞는가"를 먼저 묻는 습관이다.
