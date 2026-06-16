"""Figma prefetch 인메모리 캐시 단위 테스트.

- 성공 결과 저장/조회(hit)
- 빈 결과(실패)는 캐싱 안 함
- 조회 시 복사본 반환(캐시 오염 방지)
- TTL 만료
- 크기 상한 초과 시 오래된 항목 제거
"""

from app.services import tool_calling_loop as tcl


def _clear():
    tcl._prefetch_cache.clear()


def test_store_and_get_hit():
    _clear()
    tcl._store_prefetch("k1", ("structure", {"1:2": "detail"}, "imgb64", "image/png"))
    got = tcl._get_cached_prefetch("k1")
    assert got is not None
    assert got[0] == "structure"
    assert got[1] == {"1:2": "detail"}
    assert got[2] == "imgb64"
    assert got[3] == "image/png"


def test_empty_result_not_cached():
    _clear()
    tcl._store_prefetch("k2", ("", {}, "", ""))
    assert tcl._get_cached_prefetch("k2") is None
    assert "k2" not in tcl._prefetch_cache


def test_get_returns_copy_no_poison():
    _clear()
    tcl._store_prefetch("k3", ("s", {"a": "1"}, "", ""))
    got = tcl._get_cached_prefetch("k3")
    got[1]["a"] = "MUTATED"  # 호출자가 반환값을 가공해도
    again = tcl._get_cached_prefetch("k3")
    assert again[1]["a"] == "1"  # 캐시는 오염되지 않아야 함


def test_ttl_expiry():
    _clear()
    tcl._store_prefetch("k4", ("s", {}, "", ""))
    # 저장 시각을 TTL 이전으로 강제 → 만료
    ts, val = tcl._prefetch_cache["k4"]
    tcl._prefetch_cache["k4"] = (ts - tcl._PREFETCH_CACHE_TTL - 1, val)
    assert tcl._get_cached_prefetch("k4") is None
    assert "k4" not in tcl._prefetch_cache  # 만료 시 제거


def test_size_cap_evicts_oldest():
    _clear()
    for i in range(tcl._PREFETCH_CACHE_MAX):
        tcl._store_prefetch(f"k{i}", (f"s{i}", {}, "", ""))
    assert len(tcl._prefetch_cache) == tcl._PREFETCH_CACHE_MAX
    # 한 개 더 → 상한 유지 + 신규 항목 존재 (오래된 것 하나 제거됨)
    tcl._store_prefetch("knew", ("snew", {}, "", ""))
    assert len(tcl._prefetch_cache) == tcl._PREFETCH_CACHE_MAX
    assert "knew" in tcl._prefetch_cache
