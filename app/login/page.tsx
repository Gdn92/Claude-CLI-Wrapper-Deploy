'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password: pw }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      router.push('/')
    } else {
      setErr(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <form onSubmit={submit} className="flex flex-col gap-3 w-72">
        <h1 className="text-white text-lg font-medium">Claude CLI Wrapper</h1>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="Password"
          className="bg-neutral-800 text-white px-3 py-2 rounded-md border border-neutral-700 outline-none focus:border-neutral-400"
        />
        {err && <p className="text-red-400 text-sm">Incorrect password</p>}
        <button
          type="submit"
          className="bg-white text-black px-3 py-2 rounded-md text-sm font-medium hover:bg-neutral-200"
        >
          Enter
        </button>
      </form>
    </div>
  )
}
