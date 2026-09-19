---
layout: post
title: "페이지네이션 피드백을 받고도 못 고친 것"
date: 2025-07-23 09:00:00 +0900
categories: [study]
tags: [kakao-tech-campus, code-review, spring-data, pagination]
description: "size=1000000을 막으라는 지적을 받고 미션 안에서는 적용하지 못했고, 석 달 뒤 팀 프로젝트에서야 상한을 둔 기록"
---

안녕하세요, 고준서입니다. 카카오테크캠퍼스 세 번째 미션(spring-gift-enhancement)에서 받은 페이지네이션 피드백 이야기예요. 페이지네이션은 목록을 한 번에 다 주지 않고 몇 개씩 나눠 주는 방식인데, 2단계 미션 주제가 이거였습니다. 멘토가 짚어 준 문제 세 가지 중 미션이 끝날 때까지 하나도 고치지 못했고, 그중 하나는 석 달 뒤 팀 프로젝트에서야 적용했습니다. 무엇을 듣고 무엇을 못 했는지 그대로 적어 둡니다.

## 2단계 PR에 달린 코멘트

7월 20일에 올린 2단계 PR([#266](https://github.com/next-step/spring-gift-enhancement/pull/266))에서 상품 검색은 이렇게 돼 있었습니다.

```java
// src/main/java/gift/product/service/ProductService.java (origin/step2)
    public Page<ProductResponse> search(String name, Pageable pageable) {
        Page<Product> page = (name == null || name.isBlank())
                ? repository.findAll(pageable)
                : repository.searchByName(name, pageable);

        return page.map(ProductResponse::from);
    }
```

`Pageable`은 스프링이 요청의 `page`, `size`, `sort` 값을 묶어 주는 객체이고, 그걸 그대로 받아서 저장소에 넘기는 코드예요. 다음 날 새벽에 멘토가 이 줄에 코멘트 두 개를 남겼습니다.

> 파라미터로 Pageable 을 그대로 받는 것도 좋습니다!
> 다만, 사용자가 ?size=1000000 을 넣게 된다면 사실상 페이지네이션의 의미가 없어지게 됩니다 😅
> 그렇기 때문에, 적절한 MaxSize 를 통해 벨리데이션, 또는 max 값을 강제해야 될 것 같아요.
> 또한, sortProperty 에 존재하지 않는 필드가 들어오게 된다면 어떻게 처리할 것인지? 에 대한 고민도 필요해보이네요.
> 그렇기 때문에 Pageable 대신 별개의 pageRequestDto 를 설계하는 방법도 있을 것 같은데요, 이러한 문제를 어떻게 처리해야 할 지 한 번 고민해보세요!

> Page 객체를 사용하시는 것도 좋습니다!
> 다만 Page는 내부적으로 전체 데이터 개수(count) 를 알아야 하기 때문에, 추가적으로 count 쿼리가 실행됩니다.
> 이 count 쿼리는 대용량 테이블일 경우 성능상 부담이 될 수 있어요.
> 이러한 상황을 회피하기 위해 Slice 가 존재합니다.
> Slice는 다음 페이지 존재 여부만 판단하기 때문에 count 쿼리를 실행하지 않습니다.

그리고 API 컨트롤러의 `getAll()`에는 이런 코멘트가 있었어요.

> 2단계 미션이 페이지네이션 구현인 만큼, getAll() 메서드에 대해서는 페이징 처리가 반드시 되어야 할 것 같습니다 :) (어드민 쪽 처럼요!)
> 조금만 list 의 크기가 커져도, 심각한 성능 저하를 불러올 수 있습니다.

관리자 화면 쪽은 페이지로 나눠 놓고, API 쪽 `getAll()`은 목록을 통째로 돌려주고 있었던 거예요. 리뷰는 승인으로 끝났고, 승인 코멘트에는 "모든 getAll() 과 같은 메서드들은 페이징 처리가 필수적입니다"와 함께 읽어 보라는 블로그 링크가 붙어 있었습니다.

## 3단계 PR 본문에 적은 것

정리하면 세 가지였습니다. size에 상한을 두거나 별도 요청 DTO를 만들 것, 정렬 필드가 없는 이름일 때를 처리할 것, 전체 개수가 필요 없으면 `Page` 대신 `Slice`를 쓸 것. 그리고 API의 `getAll()`도 페이지로 나눌 것.

이틀 뒤 올린 3단계 PR([#328](https://github.com/next-step/spring-gift-enhancement/pull/328)) 본문에 저는 이렇게 썼습니다.

> 페이지 성능부담 고려해서 개선하는 작업을 하고싶었지만 시간이 지체될 것 같아서 필수요구사항부터 해결했습니다.
> 오늘 step0이라 시간이 있으니 마저 하겠습니다.

3단계의 필수 요구사항은 상품 옵션이었고, 그쪽을 먼저 했어요. 위시리스트에는 페이지를 붙였습니다([c48316d](https://github.com/gary5876/spring-gift-enhancement/commit/c48316d), 7월 21일 밤, `@PageableDefault(size = 5)`). 하지만 "마저 하겠습니다"라고 쓴 것들은 하지 못했습니다. 최종 코드의 `ProductService.search`는 2단계와 같은 다섯 줄 그대로이고, `Pageable`에 상한이 없고, 정렬 필드 검증도 없고, `Slice`는 어디에도 없어요. API의 `getAll()`도 여전히 목록 전체를 돌려줍니다.

```java
// src/main/java/gift/product/controller/ProductApiController.java (origin/step3)
    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAll() {
        return ResponseEntity.ok(productService.findAllProducts());
    }
```

3단계 승인 코멘트는 이랬습니다.

> 미션을 수행하시면서 조금은 시간이 빠듯하셨을텐데요, 다음 단계를 진행하시면서 지금까지의 코멘트를 읽어보시고, 반영해봄직한 부분은 피드백 반영해보시는 것도 좋을 것 같아요 👍

다음 단계는 다른 미션(spring-gift-order)이었고, 거기서도 이 코드로 돌아가지 않았습니다.

## 석 달 뒤, 팀 프로젝트에서

이 피드백 중 하나는 팀 프로젝트 동아리움(Team18_BE, 백엔드 3인과 프론트엔드 3인)에서 적용했습니다. 공지사항 도메인은 제가 맡았는데, 2025년 10월 26일에 만든 공지 목록 API는 요청 파라미터에서 바로 상한을 겁니다.

```java
// domain/notices/controller/NoticeController.java:45-48
            @RequestParam(value = "page", defaultValue = "1")@Min(1) Integer page,
            @RequestParam(value = "size", defaultValue = "10")@Min(1) @Max(100) Integer size
```

`?size=1000000`을 보내면 검증에서 막히고, 페이지는 1부터 시작하게 했어요. 서비스는 그 값으로 `PageRequest.of(p, s)`를 만들어 저장소에 넘깁니다. `Pageable`을 그대로 받지 않고 숫자 두 개만 받아서 검증하는 쪽을 택한 거라, 멘토가 말한 "별개의 pageRequestDto" 방향에 가깝습니다. 정렬 필드 문제는 정렬 파라미터 자체를 받지 않는 것으로 없앴고요.

다만 `Slice`는 거기서도 쓰지 않았습니다. 공지 목록 저장소는 `Page<Notice> findAlive(Pageable pageable)`이고, 화면에서 전체 페이지 수를 보여 주니 `Page`가 맞다고 봤어요. 미션 때 배운 "전체 개수를 보여줘야 하면 Page"라는 기준으로 고른 것이긴 한데, 공지 수가 count 쿼리가 부담될 규모는 아니어서 실제로 재 본 적은 없습니다.

미션 안에서 못 고친 세 가지 중 하나를 석 달 뒤에 적용한 셈입니다. 나머지 둘은 지금도 그 미션 저장소에 그대로 있어요.
