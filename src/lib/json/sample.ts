/**
 * Sample documents shown on first load. Between them they exercise every difference kind:
 * added (`email`, `tags[2]`), removed (`legacyId`), modified (`name`, `age`), type change
 * (`active`: string to boolean, `address`: object to array) and an array change (`scores`).
 */
export const SAMPLE_ORIGINAL = `{
  "id": 1042,
  "name": "Ada Lovelace",
  "age": 36,
  "active": "true",
  "legacyId": "A-17",
  "address": {
    "city": "London",
    "zip": "N1 9GU"
  },
  "tags": ["math", "poetry"],
  "scores": [10, 20, 30, 40]
}
`

export const SAMPLE_MODIFIED = `{
  "id": 1042,
  "name": "Augusta Ada King",
  "age": 37,
  "active": true,
  "email": "ada@example.com",
  "address": ["London", "N1 9GU"],
  "tags": ["math", "poetry", "engines"],
  "scores": [10, 25, 30]
}
`
