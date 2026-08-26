export default function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--border)] bg-[var(--card-bg)] py-10 text-center text-sm text-[#b0aea9]">
      © {new Date().getFullYear()} Recing · Terms · Help
    </footer>
  );
}
