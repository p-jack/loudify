# loudify

`loudify` is a tiny library that makes objects "loud." A loud object
can broadcast changes when its properties are set.

```typescript
import { loudify } from "loudify"

const user = loudify({
  id:"A18C978A-7A2C-4EA4-BBFF-75C1EF30FCC3",
  email:"fake@example.com",
  name:"Reba"
})

type User = typeof user

user.hear("name", user => {
  console.log("name changed to " + user.name)
})

user.name = "Flugelhorn"
// console will print the change
```
