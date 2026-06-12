export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-[#2A2F3A] bg-[#181C23] text-[#C4C4CC]">
      {/* Upper */}
      <div className="w-full py-6 flex flex-col items-center">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-8 max-w-4xl w-full px-6">
          <p className="text-[15px] text-[#C4C4CC] font-sans">&copy; {currentYear} VenueFi</p>

          <nav className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-[15px] text-[#C4C4CC] font-sans">
            <a href="/" className="hover:text-[#F3F4F6] transition-colors duration-200">
              Home
            </a>
            <a href="/venues" className="hover:text-[#F3F4F6] transition-colors duration-200">
              Venues
            </a>
            <a
              href="https://github.com/victoradauto1/venufi"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#F3F4F6] transition-colors duration-200"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-[#2A2F3A]" />

      {/* Lower */}
      <div className="w-full py-10 px-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
          {/* Social */}
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/victoradauto1/venufi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9898A0] hover:text-[#F3F4F6] transition-colors duration-200"
            >
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </a>

            <a href="javascript:void(0)" className="text-[#9898A0] hover:text-[#F3F4F6] transition-colors duration-200">
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23 3a10.9 10.9 0 0 1-3.1 1.5A4.48 4.48 0 0 0 16.5 3c-2.5 0-4.5 2-4.5 4.4 0 .3 0 .7.1 1A12.9 12.9 0 0 1 3 4s-4 9 5 13a13.4 13.4 0 0 1-8 2c9 5 20 0 20-11.5v-.5A7.7 7.7 0 0 0 23 3z" />
              </svg>
            </a>

            <a href="javascript:void(0)" className="text-[#9898A0] hover:text-[#F3F4F6] transition-colors duration-200">
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.45 20.45h-3.6v-5.4c0-1.3 0-3-1.9-3s-2.1 1.5-2.1 2.9v5.4h-3.6V9h3.4v1.6h.1a3.7 3.7 0 0 1 3.3-1.8c3.5 0 4.1 2.3 4.1 5.2v6.4z" />
              </svg>
            </a>
          </div>

          <p className="text-center text-[15px] leading-[1.9] max-w-lg text-[#9898A0] font-sans">
            <span className="text-[#C4C4CC]">
              Built with Solidity, Hardhat, Next.js and Ethers.js
            </span>
            <br />
            VenueFi is a non-custodial protocol. Users are fully responsible for
            their wallet interactions and investment decisions.
          </p>
        </div>
      </div>
    </footer>
  );
}
