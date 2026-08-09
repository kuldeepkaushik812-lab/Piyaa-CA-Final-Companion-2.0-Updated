import React, { useState } from 'react';
import { Brain, RotateCcw, Check, X } from 'lucide-react';

const FLASHCARDS = {
  FR: [
    { id: 'fr1', front: 'Ind AS 115', back: 'Revenue from Contracts with Customers. 5-Step Model: 1) Identify contract, 2) Identify POs, 3) Determine transaction price, 4) Allocate price, 5) Recognize revenue.' },
    { id: 'fr2', front: 'Ind AS 116', back: 'Leases. Lessee recognition: Right-of-use asset & lease liability. Exceptions: Short-term leases & low-value assets.' },
    { id: 'fr3', front: 'Ind AS 36', back: 'Impairment of Assets. Carrying Amount > Recoverable Amount. Recoverable Amount = Higher of Fair Value less costs to sell and Value in Use.' }
  ],
  Audit: [
    { id: 'au1', front: 'SA 700 (Revised)', back: 'Forming an Opinion and Reporting on Financial Statements. Unmodified opinion.' },
    { id: 'au2', front: 'SA 705 (Revised)', back: 'Modifications to the Opinion in the Independent Auditor\'s Report. Qualified, Adverse, Disclaimer.' },
    { id: 'au3', front: 'SA 570 (Revised)', back: 'Going Concern. Auditor\'s responsibility to assess management\'s use of going concern basis of accounting.' }
  ],
  Tax: [
    { id: 'tx1', front: 'Section 115BAA', back: 'Corporate tax rate of 22% for domestic companies subject to certain conditions (no specified deductions).' },
    { id: 'tx2', front: 'Section 194R', back: 'TDS on benefit or perquisite in respect of business or profession @ 10% if value > ₹20,000.' },
    { id: 'tx3', front: 'GST Section 16', back: 'Eligibility and conditions for taking Input Tax Credit (ITC).' }
  ]
};

export const FlashcardVault: React.FC = () => {
  const [category, setCategory] = useState<'FR' | 'Audit' | 'Tax'>('FR');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [learningQueue, setLearningQueue] = useState(FLASHCARDS.FR);

  const handleCategoryChange = (cat: 'FR' | 'Audit' | 'Tax') => {
    setCategory(cat);
    setLearningQueue([...FLASHCARDS[cat]]);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleNext = (remembered: boolean) => {
    const currentCard = learningQueue[currentIndex];
    let newQueue = [...learningQueue];
    
    // Spaced repetition logic mock: If forgot, add to end of queue to review again
    if (!remembered) {
      newQueue.push(currentCard);
    }
    
    if (currentIndex + 1 < newQueue.length) {
      setLearningQueue(newQueue);
      setCurrentIndex(currentIndex + 1);
    } else {
      // Completed round
      alert("Round completed! Great job.");
      setLearningQueue([...FLASHCARDS[category]]);
      setCurrentIndex(0);
    }
    setIsFlipped(false);
  };

  const currentCard = learningQueue[currentIndex] || { id: 'fallback', front: 'No Card Content', back: 'No Answer Content' };
  
  // Graceful fallback for custom user flashcards that might lack 'front', 'back', 'question', 'answer', or 'standardRef'
  const cardFront = currentCard.front || (currentCard as any).question || 'Untitled Question';
  const cardBack = currentCard.back || (currentCard as any).answer || 'No Answer Provided';
  const standardRef = (currentCard as any).standardRef || '';
  const boxNum = (currentCard as any).box || 1;
  const nextReviewDate = (currentCard as any).nextReviewDate || 'Today';

  return (
    <div className="glass-panel p-6 rounded-3xl border border-amber-500/30 shadow-xl backdrop-blur-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-amber-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-900/60 rounded-2xl flex items-center justify-center border border-amber-500/40 shadow-lg">
            <Brain className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-wide">Flashcard Memory Vault 🧠</h2>
            <p className="text-sm text-amber-200/70 font-medium">Ind AS, SA & Tax Sections</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['FR', 'Audit', 'Tax'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                category === cat ? 'nature-button text-white shadow-lg' : 'glass-card text-amber-200 border border-amber-500/30 hover:bg-amber-900/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center py-10">
        <p className="text-amber-200 mb-4 text-sm font-bold flex items-center gap-2">
          <span>Card {currentIndex + 1} of {learningQueue.length}</span>
          <span className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-[10px] text-amber-300 font-mono">
            Leitner Box {boxNum}
          </span>
          {standardRef && (
            <span className="px-2 py-0.5 rounded bg-violet-950/40 border border-violet-500/30 text-[10px] text-violet-300 font-mono">
              Ref: {standardRef}
            </span>
          )}
        </p>
        
        <div 
          className="w-full max-w-lg h-64 perspective-1000 cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
            {/* Front */}
            <div className="absolute w-full h-full backface-hidden glass-card border-2 border-amber-500/40 rounded-3xl flex flex-col items-center justify-center p-8 bg-slate-900/90 shadow-2xl">
              <h3 className="text-4xl font-black text-amber-100 text-center">{cardFront}</h3>
              <p className="absolute bottom-4 text-[10px] text-amber-400/50 uppercase tracking-widest font-bold">Click to flip</p>
            </div>
            
            {/* Back */}
            <div className="absolute w-full h-full backface-hidden glass-card border-2 border-amber-500/40 rounded-3xl flex flex-col items-center justify-center p-8 bg-slate-900/90 shadow-2xl rotate-y-180">
              <p className="text-lg text-amber-50 font-medium leading-relaxed text-center">{cardBack}</p>
            </div>
          </div>
        </div>

        {isFlipped && (
          <div className="mt-8 flex gap-4 animate-in fade-in slide-in-from-bottom-4">
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(false); }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-900/40 hover:bg-orange-800/60 border border-orange-500/50 text-orange-100 font-bold transition-all cursor-pointer shadow-lg"
            >
              <X className="w-5 h-5" /> Forgot / Hard 🔴
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(true); }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-900/60 hover:bg-amber-800/80 border border-amber-500/50 text-amber-100 font-bold transition-all cursor-pointer shadow-lg"
            >
              <Check className="w-5 h-5" /> Remembered 🟢
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
