def snake_to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def row_to_camel(row) -> dict | None:
    if row is None:
        return None
    return {snake_to_camel(k): v for k, v in dict(row).items()}


def rows_to_camel(rows) -> list[dict]:
    return [row_to_camel(r) for r in rows]
