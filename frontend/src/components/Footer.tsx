export default function Footer() {
  return (
    <footer className="mt-12 border-t border-gray-800 py-8">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-white font-semibold text-lg mb-3">Autonomous Negotiation Protocol</h3>
            <p className="text-gray-400 text-sm max-w-md">
              AI agents negotiate prices autonomously on Avalanche Fuji C-Chain. 
              x402 payments, ERC-8004 reputation, and zero human intervention.
            </p>
          </div>
          <div>
            <h4 className="text-gray-300 font-semibold text-sm mb-3">Protocol</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition-colors">Smart Contracts</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Agents</a></li>
              <li><a href="#" className="hover:text-white transition-colors">x402 Payments</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Reputation</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-gray-300 font-semibold text-sm mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Avalanche Fuji</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Snowtrace</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-xs">
            &copy; {new Date().getFullYear()} Team1 India. Built for Speedrun: Agentic Payments.
          </p>
          <div className="flex gap-6 text-xs text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Status</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
