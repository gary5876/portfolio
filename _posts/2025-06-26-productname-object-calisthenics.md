---
layout: post
title: "생활체조 원칙이 요구하는 줄 알았던 ProductName 클래스"
date: 2025-06-26 09:00:00 +0900
categories: [study]
tags: [kakao-tech-campus, code-review, spring-boot]
summary: "첫 코드리뷰에서 '왜 이렇게 짰나요'를 받고, 원칙을 흉내 냈을 뿐 의도를 설명하지 못했던 기록"
---

> 이 클래스의 용도는 무엇일까요? 상품명을 나타내기 위한 코드인것 같아요~
> 왜 이렇게 코드를 작성하려고 했는지 궁금합니다.

안녕하세요, 고준서입니다. 카카오테크캠퍼스 3기 백엔드 과정의 첫 미션(spring-gift-product) 1단계, 그러니까 제가 받은 첫 코드리뷰 이야기예요. 2025년 6월 24일에 상품 API를 만드는 개인 과제 PR([#67](https://github.com/next-step/spring-gift-product/pull/67))을 올렸고, 다음 날 낮에 멘토가 코멘트 네 개를 남기고 "수정 요청" 상태로 돌려보냈습니다. 그중 하나가 위의 질문이었어요. 고치라는 말이 아니라 이유를 묻는 말이었는데, 저는 그 이유를 제대로 답하지 못했습니다.

## 상품명을 감싸는 클래스

그때 코드에는 상품 이름, 가격, 이미지 주소를 각각 감싸는 클래스가 따로 있었습니다. `ProductName`은 이렇게 생겼어요.

```java
// src/main/java/gift/Model/ProductName.java (9f2c3f70 직전)
package gift.Model;

public class ProductName {
    private final String value;

    public ProductName(String value) {
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException("상품 이름은 비어 있을 수 없습니다.");
        }
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
```

`Price`와 `ImgUrl`도 같은 모양이었고, 정작 `Product` 자체는 `String name`, `int price`, `String imgURL` 필드를 가진 평범한 클래스였습니다. 감싸는 클래스는 만들어 놓고 실제 상품 객체는 감싼 값을 풀어서 담고 있었던 거예요. 컨트롤러에서는 `request.toName().getValue()`처럼 한 번 감쌌다가 바로 다시 풀어서 썼습니다.

같은 PR에는 샘플 데이터를 코드에 박아 넣은 클래스도 있었습니다.

```java
// src/main/java/gift/Dto/ProductRequestSample.java (9f2c3f70 직전)
public class ProductRequestSample extends ProductRequest {
    public ProductRequestSample() {
        super(
                "아이스 카페 아메리카노 T",
                4500,
                "https://st.kakaocdn.net/product/gift/product/20231010111814_9a667f9eccc943648797925498bdd8a3.jpg"
        );
    }
}
```

요청 DTO(화면이나 클라이언트에서 넘어오는 값을 담는 클래스)를 상속해서 생성자에 예시 상품을 채워 두고, 컨트롤러가 만들어질 때 그걸 저장소에 넣게 해 뒀어요. 미션 문서에 예시 상품이 적혀 있길래 그 데이터가 처음부터 들어 있어야 하는 줄 알았던 겁니다.

## 코멘트 네 개

6월 25일 낮에 달린 코멘트는 이랬습니다. `ProductRequestSample`에는

> 1. Sample 데이터를 직접 코드에 넣는것은 제 주관적인 생각으로 좋은 코드습관은 아닌것 같아요~
> 2. 상속은 최대한 필요한경우에만 사용하고, Dto, Request 이런 클래스들에는 사용하지 않는게 좋아보여요
> 필드를 재활용하기보다는, 메서드, 기능을 정의한다는 관점에서 상속, 인터페이스를 이용하는것이 중요합니다

컨트롤러가 상품 목록을 필드로 직접 들고 있는 것에는

> products 필드가 Controller에 바로 있네요~
> 사실 요구사항을 만족하는 가장 간단한 코드예요! 👍 👍
> 하지만 코드의 양이 많아질수록, 기능 책임을 분리하는게 이후 확장성을 고려하였을때 더 좋을 수도 있습니다.
> 그렇다고해서 너무 많이 책임을 분리한다면, 오히려 더 복잡한 코드가 될 수도 있는데요, 이런 부분은 트레이드 오프로써 개발자의 취향차이로 봐야할것 같아요.

그리고 `ProductName`에는 맨 위의 질문. 다음 날 아침 일찍 답글을 달았습니다. 샘플 클래스에는

> sample 삭제했습니다
> 이 데이터를 넣어놓아야 하는 줄 알고 했는데, 없어도 되는 것 같네요

`ProductName`에는

> 이렇게 쓰는게 불필요하다고 생각은 했지만, 객체지향 생활체조원칙이 이런걸 요구하는 줄알고 한번 해봤습니다.
> 다시 돌려놓았습니다

객체지향 생활체조는 "모든 원시값과 문자열을 포장한다" 같은 아홉 가지 연습 규칙을 말합니다. 그 규칙이 있는 건 맞아요. 다만 저는 그 규칙을 왜 지키는지, 이 미션의 상품 이름에 그게 무슨 이득을 주는지는 답하지 못했고, 답글에 적은 대로 스스로도 불필요하다고 느끼고 있었습니다. 원칙을 적용한 게 아니라 원칙의 모양을 흉내 낸 거였죠.

같은 날 아침 커밋([9f2c3f70](https://github.com/next-step/spring-gift-product/commit/9f2c3f70), 메시지 "exception 삭제, if 문으로 controller내부처리, entity(model)간소화)")으로 정리했습니다. 10개 파일에서 35줄이 늘고 169줄이 줄었어요. `ProductName`, `Price`, `ImgUrl`, `ProductRequestSample`을 지우고 `Product`를 `Entity` 패키지로 옮겼습니다. 그런데 커밋 메시지에 적힌 대로, 지적받지 않은 것까지 같이 지웠습니다. 상품이 없을 때 던지던 `ProductNotFoundException`과 그걸 받아 응답으로 바꾸던 `GlobalExceptionHandler`를 없애고 컨트롤러 안의 if 문으로 되돌렸어요. 멘토가 예외 처리를 지적한 적은 없었습니다. 되돌리는 김에 "간소화"라는 이름으로 전부 걷어낸 건데, 예외를 한 곳에서 받는 구조는 세 번째 미션에서 다시 만들게 됩니다.

멘토는 그날 오후에 이렇게 답하고 승인해 주셨어요.

> 네네 코드가 이상하다! 이런건 아니였고, 의도가 궁금했어요~ 불필요하다고 생각하셨다면 코드를 제거해도 좋습니다.
> 고생하셨습니다!

## 이 리뷰에서 남은 것

첫 리뷰의 코멘트 네 개 중 "고치세요"는 하나도 없었습니다. 하나는 스프링의 초기화 방식을 소개하는 참고였고, 하나는 지금 구조도 괜찮다는 트레이드오프 이야기였고, 하나는 습관에 대한 의견이었고, 나머지 하나가 "왜"였어요. 코드가 틀렸다는 지적은 없었고, 요구사항은 전부 통과한 상태였어요. 그래서 그때 배운 건 코드를 어떻게 짜느냐보다, 짠 코드에 대해 "왜"를 물으면 답이 있어야 한다는 쪽이었습니다. 답이 없으면 그 코드는 남의 규칙을 옮겨 적은 것이고, 지우는 게 맞다는 것도요.

컨트롤러가 상품 목록을 직접 들고 있는 구조는 이 단계에서는 그대로 뒀습니다. 그리고 바로 다음 단계에서 관리자 화면용 컨트롤러가 하나 더 생기면서 상품 목록이 두 군데로 갈라졌고, 그때 "이제는 저장소 코드를 분리해야할때가 된것 같아요"라는 코멘트를 받고 `ProductRepository`를 만들었어요. 1단계 리뷰에서 "지금은 안 해도 되지만 필요해지면"이라고 했던 그 필요가 이틀 만에 왔던 셈입니다. 그 뒤 이야기는 [ID 발번 글]({{ "/2025/07/01/id-generation-three-times/" | relative_url }})에 있습니다.
