from services.api.app.ml.department_router import route_category


def test_known_category_routes_to_expected_department():
    result = route_category("IT & Network", 0.91)
    assert result.department_code == "IT"
    assert result.method == "category-mapping"
    assert result.confidence == 0.91


def test_unknown_category_uses_general_fallback():
    result = route_category("Unknown", 0.33)
    assert result.department_code == "GEN"
    assert result.method == "fallback"
    assert result.confidence == 0.50
