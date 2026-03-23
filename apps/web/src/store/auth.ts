interface User { id: string; email: string }

let _user: User | null = null
let _listeners: (() => void)[] = []

export function getUser() { return _user }
export function getToken() { return localStorage.getItem('token') }

export function setAuth(user: User, token: string) {
  _user = user
  localStorage.setItem('token', token)
  _listeners.forEach(fn => fn())
}

export function logout() {
  _user = null
  localStorage.removeItem('token')
  _listeners.forEach(fn => fn())
}

export function onAuthChange(fn: () => void) {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter(l => l !== fn) }
}
