import { Link } from "react-router-dom";

export const Navbar = () => {
  return (
    <header className="fixed top-0 left-0 w-full bg-teal-400 bg-opacity-50 z-50 shadow-lg">
      <nav className="flex items-center h-20 cs-container px-6">
        <Link
          to="/"
          className="flex items-center font-extrabold text-4xl tracking-wide"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <img
            src="/EmPulseHR-logo.png"
            alt="EmPulseHR Logo"
            className="w-14 h-14 mr-3 transform scale-150"
            style={{ objectFit: "cover" }}
          />
        </Link>
        <div className="ml-auto flex items-center space-x-6">
          <a
            href="/about"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-medium hover:text-teal-300 transition duration-150"
          >
            About
          </a>
        </div>
      </nav>
    </header>
  );
};
