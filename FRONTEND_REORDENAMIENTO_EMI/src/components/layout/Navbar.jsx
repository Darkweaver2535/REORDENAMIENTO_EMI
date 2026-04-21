function Navbar({ title = "Panel", rightContent }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <div>{rightContent}</div>
    </header>
  );
}

export default Navbar;
