import { Construction } from 'lucide-react';

export default function EmConstrucao({ titulo = 'Em Construção' }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
      <Construction size={40} />
      <p className="text-lg font-medium">{titulo}</p>
      <p className="text-sm">Esta seção está sendo desenvolvida.</p>
    </div>
  );
}
