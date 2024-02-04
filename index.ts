export type Ear<T> = (changed:T)=>void;

let globalBlock = false

interface Ears<T extends object> {
  readonly hear:(key:keyof T, ear:Ear<Loud<T>>)=>void
  readonly stopHearing:(key:keyof T, ear:Ear<Loud<T>>)=>void
  readonly isHearing:(keys:keyof T, ear:Ear<Loud<T>>)=>boolean
}

export type Loud<T extends object> = Ears<T> & T

const earSymbol = Symbol("ears")

export const loudify = <T extends object>(object:T):Loud<T> => {
  type E = Ear<Loud<T>>
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
    }
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
  proxy["stopHearing"] = (property:keyof T, ear:E) => {
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
  const ears:Map<keyof T, Set<Ear<T>>> = (source as any)[earSymbol]
  const set = ears.get(key);
  set?.forEach(ear => { ear(source) })
}

export class Tx {

  private readonly batches:Batch<any>[] = []

  readonly batch = <T extends object>(target:Loud<T>, changes:Partial<T>) => {
    this.batches.push({target, changes})
  }

  readonly commit = () => {
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
      globalBlock = false
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

let check = <T extends object,K extends keyof T>(obj:T, key:K, value:T[K]):void => {}
export const checkWith = (checker:<T extends object,K extends keyof T>(obj:T, key:keyof T, value:T[K])=>void) => {
  check = checker
}
