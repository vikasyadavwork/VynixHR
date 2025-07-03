export const AboutPage = () => {
  return (
    <section className="min-h-screen bg-gradient-to-r from-gray-100 via-gray-200 to-gray-300 flex items-center justify-center">
      <div className="text-center p-6 max-w-4xl">
        {/* Title */}
        <h1 className="text-5xl font-extrabold text-gray-800 mb-6">
          Unveiling the Identity of Our Next Big Leap — <span className="text-blue-600">EmPulseHR</span>
        </h1>

        {/* Intro Paragraph */}
        <p className="text-lg text-gray-700 mb-8 leading-relaxed">
          A few days ago, I shared why HRMS is no longer a luxury but a necessity for growing organizations. Today, I’m thrilled to give you the first visual glimpse of our upcoming offering — <span className="font-semibold text-blue-600">EmPulseHR</span>, AetherX Tech’s smart, intuitive, and people-first HRMS solution.
        </p>

        {/* Logo Meaning Section */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">What Our Logo Represents</h2>
          <ul className="text-left text-gray-700 space-y-4">
            <li>
              <span className="font-semibold text-blue-600">👥 People at the Core:</span> EmPulseHR is designed with people-first principles, ensuring every employee feels valued.
            </li>
            <li>
              <span className="font-semibold text-blue-600">💓 Pulse of Every Organization:</span> We aim to be the heartbeat of your workforce, keeping everything running smoothly.
            </li>
            <li>
              <span className="font-semibold text-blue-600">🔄 Seamless Workforce Management:</span> Simplifying HR processes with intuitive tools and automation.
            </li>
            <li>
              <span className="font-semibold text-blue-600">📊 Data-driven HR Intelligence:</span> Empowering organizations with actionable insights and analytics.
            </li>
          </ul>
        </div>

        {/* Vision Section */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Reimagining Workforce Management</h2>
          <p className="text-lg leading-relaxed">
            With <span className="font-semibold">EmPulseHR</span>, we are reimagining how modern businesses manage their human capital — integrating intelligence, empathy, and innovation into one powerful platform.
          </p>
        </div>

        {/* Closing Section */}
        <p className="text-lg text-gray-700 mt-8">
          More details and product previews coming soon! Stay connected. Something exciting is on its way. 🌐
        </p>
      </div>
    </section>
  );
};