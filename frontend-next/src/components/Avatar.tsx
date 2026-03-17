import React from 'react'

export type AvatarProps = {
  src?: string | null
  alt?: string
  size?: number
  className?: string
}

export function Avatar({ src, alt = 'avatar', size = 40, className = '' }: AvatarProps) {
  const [imgSrc, setImgSrc] = React.useState<string>(src ? src : '/placeholder-avatar.png')
  React.useEffect(()=>{
    setImgSrc(src ? src : '/placeholder-avatar.png')
  }, [src])
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={alt}
      width={size}
      height={size}
      className={`rounded object-cover ${className}`}
      onError={(e)=>{ const t = e.target as HTMLImageElement; t.onerror = null; setImgSrc('/placeholder-avatar.png') }}
    />
  )
}
