function PageWrapper({ title, description, children, actions }) {
  return (
    <section className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4
          pb-6 border-b-2 border-gray-200">
        <div>
          <h1 className="text-[28px] font-extrabold text-gray-900 tracking-tight leading-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-[16px] text-gray-500 leading-relaxed font-medium">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}

export default PageWrapper;
