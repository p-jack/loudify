import { 
  loudify,
  Loud,
  extendWith,
  compareWith,
  checkWith,
  Tx
} from "./index"

afterEach(() => {
  extendWith(<T extends object>(loud:Loud<T>, quiet:T) => {})
  compareWith(Object.is)
  checkWith(<T extends object,K extends keyof T>(o:T, k:K, v:T[K]):void => {})
})

describe("loudify", () => {
  type I = { id:number, email:string }
  let obj:Loud<I>
  let captured:I|undefined
  const ear = (v:Loud<I>) => {
    captured = v
  }
  beforeEach(() => { 
    obj = loudify({
      id: 0,
      email: "fake@example.com"
    })
    captured = undefined 
  })
  test("notified right away when heard", () => {
    obj.hear("email", ear)
    expect(captured).toBe(obj)
  })
  test("hear and stopHearing", () => {
    expect(obj.isHearing("email", ear)).toBe(false)
    obj.hear("email", ear)
    expect(obj.isHearing("email", ear)).toBe(true)
    expect(captured).toBe(obj)
    captured = undefined
    obj.email = "fake2@example.com"
    expect(captured).toBe(obj)  
    captured = undefined
    obj.stopHearing("email", ear)
    expect(obj.isHearing("email", ear)).toBe(false)
    obj.email = "fake3@example.com"
    expect(captured).toBeUndefined()
  })
  test("not heard", () => {
    obj.hear("email", ear)
    captured = undefined
    obj.id = 1
    expect(captured).toBeUndefined()
  })
  test("same value", () => {
    obj.hear("id", ear)
    captured = undefined
    obj.id = 0
    expect(captured).toBeUndefined()
  })
  test("multiple ears", () => {
    let captured2:I|undefined
    const ear2 = (v:I) => {
      captured2 = v
    }
    obj.hear("email", ear)
    obj.hear("email", ear2)
    expect(captured2).toBe(obj)
    captured = undefined
    captured2 = undefined
    obj.email = "fake2@example.com"
    expect(captured).toBe(obj)
    expect(captured2).toBe(obj)
  })
})

test("extendWith", () => {
  extendWith(<T extends object>(loud:Loud<T>, quiet:T) => {
    (loud as any)["flag"] = true
  })
  const obj = loudify({s:""})
  expect((obj as any)["flag"]).toBe(true)
})

test("compareWith", () => {
  compareWith((a:any, b:any) => {
    if ((typeof(a) == "string") && (typeof(b) === "string")) {
      const as = a as string
      const bs = b as string
      return a.toLowerCase() === b.toLowerCase()
    }
    return Object.is(a, b)
  })
  const obj = loudify({s:"a"})
  type I = typeof obj
  let flag = false
  obj.hear("s", (v:I) => {
    flag = true
  })
  flag = false
  obj.s = "A"
  expect(flag).toBe(false)
})

test("checkWith", () => {
  const check = <T extends object,K extends keyof T>(obj:T, k:K, v:T[K]) => {
    if (v === "fail") throw new Error("failed")
  }
  checkWith(check)
  const obj = loudify({ s:"" })
  expect(() => { obj.s = "fail" }).toThrow("failed")  
})

describe("tx", () => {
  test("happy path", () => {
    const a = loudify({n:111})
    const b = loudify({x:222})
    let agood = false
    let acount = 0
    a.hear("n", (v:typeof a) => {
      acount++
      agood = (v.n === 333) && (b.x === 444)
    })
    let bgood = false
    let bcount = 0
    b.hear("x", (v:typeof b) => {
      bcount++
      bgood = (a.n === 333) && (v.x === 444)
    })
    acount = 0
    bcount = 0
    const tx = new Tx()
    tx.batch(a, {n:333})
    tx.batch(b, {x:444})
    tx.commit()
    expect(agood).toBe(true)
    expect(acount).toBe(1)
    expect(bgood).toBe(true)
    expect(bcount).toBe(1)
  })
  test("check failure", () => {
    checkWith(<T extends object,K extends keyof T>(obj:T, k:K, v:T[K]) => {
      if (v === 2) throw new Error("fail")
    })
    const o = loudify({x:1,y:3})
    const tx = new Tx()
    tx.batch(o, {x:3,y:2})
    expect( () => { tx.commit() }).toThrow("fail")
    expect(o.x).toBe(1)
    expect(o.y).toBe(3)
  })
})
