"use client";
import React, { useState, useEffect } from "react";
import { ContainerScroll } from "./ContainerScroll";
import { Link } from "@/i18n/navigation";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import {
  HiOutlineGlobeAlt,
  HiOutlineShoppingCart,
  HiOutlineDevicePhoneMobile,
  HiOutlineMagnifyingGlass,
  HiOutlineWrenchScrewdriver,
} from "react-icons/hi2";
import type { IconType } from "react-icons";

const icons: Record<string, IconType> = {
  web: HiOutlineGlobeAlt,
  ecommerce: HiOutlineShoppingCart,
  mobile: HiOutlineDevicePhoneMobile,
  seo: HiOutlineMagnifyingGlass,
  maintenance: HiOutlineWrenchScrewdriver,
};

interface ServiceItem {
  key: string;
  num: string;
  title: string;
  desc: string;
}

function ServiceCard({ s }: { s: ServiceItem }) {
  const Icon = icons[s.key];
  return (
    <Link
      href="/services"
      className="group border border-line rounded-2xl p-5 md:p-6 bg-gradient-to-b from-primary/5 to-transparent hover:border-primary/30 transition-all flex flex-col gap-2"
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs tracking-[0.18em] text-primary">
          {s.num}
        </span>
        {Icon && <Icon className="w-5 h-5 text-primary" />}
      </div>
      <h3 className="font-serif text-xl md:text-2xl text-foreground">
        {s.title}
      </h3>
      <p className="text-xs md:text-sm text-text-muted leading-relaxed">
        {s.desc}
      </p>
    </Link>
  );
}

export default function ServicesScroll({
  title,
  subtitle,
  services,
}: {
  title: string;
  subtitle: string;
  services: ServiceItem[];
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const heading = (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="pill">◆ {title}</span>
      <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-foreground">
        {title.split(" ")[0]}{" "}
        <span className="text-primary italic">
          {title.split(" ").slice(1).join(" ")}
        </span>
      </h2>
      <p className="font-serif italic text-xl text-text-muted max-w-md leading-relaxed">
        {subtitle}
      </p>
    </div>
  );

  if (isMobile) {
    return (
      <section className="relative bg-surface-2 overflow-hidden py-16">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4">
          <FadeIn>{heading}</FadeIn>
          <StaggerContainer className="grid grid-cols-1 gap-4 mt-10">
            {services.map((s) => (
              <StaggerItem key={s.key}>
                <ServiceCard s={s} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>
    );
  }

  return (
    <section className="relative bg-surface-2 overflow-hidden">
      <div className="grid-bg" />
      <div className="relative">
        <ContainerScroll titleComponent={heading}>
          <div className="h-full w-full p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 auto-rows-fr gap-3 md:gap-4 overflow-y-auto">
            {services.map((s) => (
              <ServiceCard key={s.key} s={s} />
            ))}
          </div>
        </ContainerScroll>
      </div>
    </section>
  );
}
