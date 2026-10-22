export async function copyText(content: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(content)
    return
  }
  const previous = document.activeElement
  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.style.position = 'fixed'
  textarea.style.left = '-999999px'
  // Stay inside the active dialog's focus trap when one is open.
  const container = document.querySelector('[role="dialog"][data-state="open"]') || document.body
  container.appendChild(textarea)
  try {
    textarea.focus()
    textarea.select()
    if (!document.execCommand('copy'))
      throw new Error('写入剪贴板失败，请手动选择预览内容复制。')
  }
  finally {
    textarea.remove()
    if (previous instanceof HTMLElement)
      previous.focus()
  }
}
