"use client";
import React, { useEffect } from 'react';

export default function NeoTactileUI() {
  // Add haptic feedback handler
  const handleTactileClick = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50); // Short, crisp vibration
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1c20] flex items-center justify-center p-10 font-sans">
      {/* Main Glass Card */}
      <div className="w-[380px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-[40px] p-8 shadow-2xl relative overflow-hidden sm:backdrop-blur-md">
        
        {/* Header Section */}
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 shadow-lg" />
            <span className="text-white font-bold text-xl tracking-tight">UI Kit</span>
          </div>
          <div className="space-y-1">
            <div className="w-6 h-0.5 bg-white/60"></div>
            <div className="w-6 h-0.5 bg-white/60"></div>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="flex gap-4 mb-8">
          <button 
            onClick={handleTactileClick}
            className="flex-1 py-4 text-gray-800 rounded-2xl font-bold neo-button"
          >
            Default
          </button>
          <button 
            onClick={handleTactileClick}
            className="flex-1 py-4 bg-[#4d7cfe] text-white rounded-2xl font-bold shadow-[0_10px_20px_rgba(77,124,254,0.4)] border border-white/20 hover:bg-[#3b68e6] transition-colors active:scale-95"
          >
            Active
          </button>
        </div>

        {/* Tactile Control Card */}
        <div className="bg-[#e6e9ef] rounded-[30px] p-6 mb-8 shadow-inner border border-white/40 cursor-pointer" onClick={handleTactileClick}>
           <div className="flex justify-between items-center text-gray-500 mb-2 px-2">
             <span className="text-sm font-bold uppercase tracking-widest">Select</span>
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
           </div>
           <div className="h-12 bg-gray-200/50 rounded-xl border-b border-white/80"></div>
        </div>

        {/* The "Micro-Interaction" Slider */}
        <div className="space-y-6">
          <div className="relative h-2 w-full bg-black/20 rounded-full overflow-hidden cursor-pointer" onClick={handleTactileClick}>
            <div className="absolute top-0 left-0 h-full w-[60%] bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_15px_#4d7cfe]" />
          </div>
          
          {/* Toggle Switch */}
          <div className="flex justify-end">
            <div className="w-16 h-8 bg-blue-600 rounded-full p-1 flex items-center shadow-inner cursor-pointer" onClick={handleTactileClick}>
               <div className="w-6 h-6 bg-white rounded-full shadow-lg transform translate-x-8 transition-transform" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
