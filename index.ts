export type Mutable<T extends object> = { -readonly [K in keyof T]: T[K] }

let globalBlock = false

interface Hear<T extends object> {
  readonly hear:(key:keyof T, ear:(changed:Loud<T>)=>void)=>void
  readonly unhear:(key:keyof T, ear:(changed:Loud<T>)=>void)=>void
  readonly isHearing:(key:keyof T, ear:(changed:Loud<T>)=>void)=>boolean
}

export type Loud<T extends object> = T & Hear<T>

class Quiet<T> {
  constructor(readonly value:T) {}
}

export const quiet = <T>(value:T):T => new Quiet(value) as never

const earSymbol = Symbol("ears")

export const loudify = <T extends object>(object:T):Loud<T> => {
  type E = (changed:T)=>void
  const ears = new Map<keyof T, Set<E>>()
  const proxy = new Proxy(object, {
    set: (target:any, p:string | symbol, newValue:any, receiver:any):boolean => {
      if ((typeof(p) !== "symbol") && (typeof(newValue) !== "function")) {
        check(target, p, newValue)
      }
      const oldValue = target[p]
      target[p] = newValue
      if (!globalBlock && !compare(oldValue, newValue)) {
        const set = ears.get(p as keyof T);
        set?.forEach(ear => { ear(proxy as Loud<T>) })
      }
      return true
    },
    get:(target:any, p:string | symbol, receiver:any):any => {
      const value = target[p]
      if (p === "constructor") {
        return target.constructor
      }
      if (value instanceof Function) {
        return function (...args:any) {
          const oldGlobalBlock = globalBlock
          globalBlock = true
          let result
          try {
            result = value.apply(receiver, args)
          } finally {
            globalBlock = oldGlobalBlock
          }
          if (result instanceof Quiet) {
            return result.value
          }
          const set = ears.get(p as keyof T)
          set?.forEach(ear => { ear(proxy as Loud<T>) })
          return result
        }
      }
      return value
    },
  })
  proxy[earSymbol] = ears
  proxy["hear"] = (property:keyof T, ear:E) => {
    let set:Set<E>;
    if (ears.has(property)) {
      set = ears.get(property)!;
    } else {
      set = new Set<E>();
      ears.set(property, set);
    }
    set.add(ear);
    ear(proxy as never)
    return;
  }
  proxy["unhear"] = (property:keyof T, ear:E) => {
    const set = ears.get(property)
    set?.delete(ear)
  }
  proxy["isHearing"] = (property:keyof T, ear:E) => {
    const set = ears.get(property)
    return set ? set.has(ear) : false
  }
  extend(proxy, object)
  return proxy as never
}

interface Batch<T extends object> {
  target:Loud<T>
  changes:Partial<T>
}

const yell = <T extends object>(source:Loud<T>, key:keyof T) => {
  const ears:Map<keyof T, Set<(changed:T)=>void>> = (source as any)[earSymbol]
  const set = ears.get(key);
  set?.forEach(ear => { ear(source) })
}

export class Tx {

  private readonly batches:Batch<any>[] = []

  readonly batch = <T extends object>(target:Loud<T>, changes:Partial<T>) => {
    this.batches.push({target, changes})
  }

  readonly commit = () => {
    const oldGlobalBlock = globalBlock
    globalBlock = true
    const batches = this.batches
    const changed:Set<string>[] = []
    try {
      for (const batch of batches) {
        for (const k in batch.changes) {
          check(batch.target, k, batch.changes[k])
        }
      }
      for (const batch of batches) {
        const set = new Set<string>()
        changed.push(set)
        for (const k in batch.changes) {
          if (!compare(batch.target[k], batch.changes[k])) {
            set.add(k)
            batch.target[k] = batch.changes[k]
          }
        }
      }
      for (let i = 0; i < batches.length; i++) {
        const set = changed[i]!
        const batch = batches[i]!
        for (const k of set) {
          yell(batch.target, k)
        }
      }
    } finally {
      globalBlock = oldGlobalBlock
    }  
  }
}

let extend = <T extends object>(loud:Loud<T>, observed:T) => {}
export const extendWith = (extender:<T extends object>(loud:Loud<T>, observed:T)=>void) => {
  extend = extender
}

let compare = Object.is
export const compareWith = (comparer:(a:any, b:any)=>boolean) => {
  compare = comparer
}

let check = <T extends object>(obj:T, key:keyof T, value:T[typeof key]):void => {}
export const checkWith = (checker:<T extends object>(obj:T, key:keyof T, value:T[typeof key])=>void) => {
  check = checker
}
