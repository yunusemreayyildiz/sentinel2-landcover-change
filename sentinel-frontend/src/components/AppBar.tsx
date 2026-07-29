import Link from "next/link";

export default function AppBar({
  baslik,
  geri,
  ileri,
}: {
  baslik: string;
  geri?: { href: string; etiket: string };
  ileri?: { href: string; etiket: string };
}) {
  return (
    <div className="bg-[rgba(139,107,83,0.3)] border border-[rgba(139,107,83,0.5)] border-solid flex h-[56px] items-center justify-between px-[24px] shrink-0 w-full">
      <p className="font-medium text-[12px] text-accents-brown lowercase">{baslik}</p>
      <div className="flex items-center gap-4">
        {geri && (
          <Link href={geri.href} className="font-medium text-[12px] text-accents-brown underline">
            {geri.etiket}
          </Link>
        )}
        {ileri && (
          <Link href={ileri.href} className="font-medium text-[12px] text-accents-brown underline">
            {ileri.etiket}
          </Link>
        )}
      </div>
    </div>
  );
}
