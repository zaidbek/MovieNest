import React from "react";
import { SearchIcon } from "./Icons.jsx";

export default function SearchBar({ value, onChange, placeholder = "Поиск…", autoFocus = false }) {
  return (
    <div className="searchbar">
      <SearchIcon className="searchbar__icon" />
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
