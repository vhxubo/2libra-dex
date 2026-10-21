import { useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface EventSearchInputProps {
  q: string
  onQueryChange: (q: string) => void
}

export function EventSearchInput({ q, onQueryChange }: EventSearchInputProps) {
  // 输入框用本地草稿值，避免每次按键都走 URL 往返打断输入法组合；
  // 组合期间（双拼/全拼的拼音过程）不上报，组合结束后才提交最终文字
  const [queryDraft, setQueryDraft] = useState(q)
  const [syncedQ, setSyncedQ] = useState(q)
  const isComposingRef = useRef(false)
  const lastCommittedRef = useRef(q)

  // 外部 q 变化（如清空搜索）时回同步到输入框
  if (q !== syncedQ) {
    setSyncedQ(q)
    setQueryDraft(q)
  }

  const commitQuery = (value: string) => {
    if (value !== lastCommittedRef.current) {
      lastCommittedRef.current = value
      onQueryChange(value)
    }
  }

  return (
    <div className="relative w-full sm:max-w-72">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={queryDraft}
        onChange={(event) => {
          setQueryDraft(event.target.value)
          if (!isComposingRef.current) {
            commitQuery(event.target.value)
          }
        }}
        onCompositionStart={() => {
          isComposingRef.current = true
        }}
        onCompositionEnd={(event) => {
          isComposingRef.current = false
          commitQuery(event.currentTarget.value)
        }}
        placeholder="搜索事件名称、代码、效果或 tier_code"
        aria-label="搜索事件"
        className="pl-9"
      />
    </div>
  )
}
