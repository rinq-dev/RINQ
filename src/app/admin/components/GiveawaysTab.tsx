"use client";

import React from "react";
import { Gift, Sparkles, Trophy, Trash2, Users } from "lucide-react";
import { Giveaway } from "../types";

interface GiveawaysTabProps {
  giveaways: Giveaway[];
  newGaTitle: string;
  setNewGaTitle: (val: string) => void;
  newGaReward: string;
  setNewGaReward: (val: string) => void;
  newGaWinners: string;
  setNewGaWinners: (val: string) => void;
  newGaDesc: string;
  setNewGaDesc: (val: string) => void;
  onDrawGiveaway: (id: number, title: string) => void;
  onDeleteGiveaway: (id: number) => void;
  onCreateGiveaway: (e: React.FormEvent) => void;
}

export default function GiveawaysTab({
  giveaways,
  newGaTitle,
  setNewGaTitle,
  newGaReward,
  setNewGaReward,
  newGaWinners,
  setNewGaWinners,
  newGaDesc,
  setNewGaDesc,
  onDrawGiveaway,
  onDeleteGiveaway,
  onCreateGiveaway,
}: GiveawaysTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      {/* Danh sách Giveaways (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              <span>Sự kiện Giveaway tri ân</span>
            </h2>
            <p className="text-xs text-slate-600 font-medium">Người dùng tham gia qua bot Telegram</p>
          </div>
          <span className="text-xs font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1">
            {giveaways.filter((g) => g.status === "ACTIVE").length} sự kiện mở
          </span>
        </div>

        <div className="space-y-4">
          {giveaways.map((g) => (
            <div
              key={g.id}
              className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3 transition-all hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-slate-900">
                      {g.title}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1.5 ${
                        g.status === "ACTIVE"
                          ? "bg-emerald-50 text-[#0e704b] border border-emerald-200"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {g.status === "ACTIVE" ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          Đang mở
                        </>
                      ) : (
                        "Đã quay thưởng"
                      )}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-purple-700 mt-1 flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                    <span>Giải thưởng: {g.reward} ({g.winnerCount} giải)</span>
                  </p>
                  {g.description && (
                    <p className="text-xs text-slate-600 mt-1">{g.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {g.status === "ACTIVE" && (
                    <button
                      onClick={() => onDrawGiveaway(g.id, g.title)}
                      className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-full text-xs font-bold transition shadow-sm active:scale-95"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      <span>Quay thưởng</span>
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteGiveaway(g.id)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                    title="Xóa sự kiện"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-200 font-medium">
                <span className="flex items-center gap-1 text-slate-800 font-semibold">
                  <Users className="h-3.5 w-3.5 text-[#0e704b]" />
                  <span>Đã có <b>{g.participantCount ?? 0}</b> khách tham gia</span>
                </span>
                <span>Ngày tạo: {new Date(g.createdAt).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
          ))}

          {giveaways.length === 0 && (
            <div className="py-8 text-center text-slate-600 text-xs">
              Chưa có sự kiện Giveaway nào.
            </div>
          )}
        </div>
      </div>

      {/* Form Tạo Giveaway (4 cols) */}
      <div className="lg:col-span-4 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span>Tạo sự kiện Giveaway mới</span>
        </h3>

        <form onSubmit={onCreateGiveaway} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tiêu đề sự kiện *
            </label>
            <input
              type="text"
              placeholder="VD: Giveaway 5 Tài Khoản ChatGPT Plus"
              value={newGaTitle}
              onChange={(e) => setNewGaTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Phần thưởng trao giải *
            </label>
            <input
              type="text"
              placeholder="VD: 5 Tài Khoản ChatGPT Plus 1 Tháng"
              value={newGaReward}
              onChange={(e) => setNewGaReward(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Số lượng người trúng
            </label>
            <input
              type="number"
              placeholder="1"
              value={newGaWinners}
              onChange={(e) => setNewGaWinners(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Mô tả thể lệ
            </label>
            <textarea
              rows={3}
              placeholder="Bấm tham gia để có cơ hội trúng giải ngẫu nhiên..."
              value={newGaDesc}
              onChange={(e) => setNewGaDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 text-xs font-bold transition shadow-sm active:scale-95"
          >
            + Mở sự kiện Giveaway ngay
          </button>
        </form>
      </div>
    </div>
  );
}

