import React from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Movies from "./pages/Movies.jsx";
import Cartoons from "./pages/Cartoons.jsx";
import Doramas from "./pages/Doramas.jsx";
import MoviePage from "./pages/MoviePage.jsx";
import WatchPage from "./pages/WatchPage.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Profile from "./pages/Profile.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Challenges from "./pages/Challenges.jsx";
import Achievements from "./pages/Achievements.jsx";
import MyProgress from "./pages/MyProgress.jsx";
import Admin from "./pages/Admin.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <>
      <Header />
      <main className="container page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/cartoons" element={<Cartoons />} />
          <Route path="/doramas" element={<Doramas />} />
          <Route path="/movie/:slug" element={<MoviePage />} />
          <Route path="/watch/:slug" element={<WatchPage />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/progress" element={<MyProgress />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
