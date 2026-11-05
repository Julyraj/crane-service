import { Link } from "react-router-dom";
import { formatINR, whatsappUrl } from "@crane/shared";
import { useSession } from "../session.tsx";

export function Home() {
  const { catalog } = useSession();
  const phone = catalog?.business.phone ?? "9789473129";
  return (
    <div className="home">
      <section className="hero">
        <div>
          <p className="eyebrow">Salem · Tamil Nadu · 24×7</p>
          <h1>Book a crane in minutes.</h1>
          <p className="lead">
            Hydra and telescopic cranes from 13 to 150 tons with trained operators. See the price before you book, track the crane
            live, and start the job with a secure OTP.
          </p>
          <div className="hero__cta">
            <Link to="/book" className="btn btn--primary btn--lg">
              Book a crane
            </Link>
            <a className="btn btn--ghost btn--lg" href={whatsappUrl(phone, "Hi, I need a crane.")} target="_blank" rel="noreferrer">
              WhatsApp us
            </a>
          </div>
        </div>
        <ol className="steps">
          <li>
            <strong>Tell us the lift</strong>
            <span>Load, height and reach — we suggest the right crane.</span>
          </li>
          <li>
            <strong>Pin your site</strong>
            <span>Upfront fare with travel, minimum hours and GST shown line by line.</span>
          </li>
          <li>
            <strong>Track & start safely</strong>
            <span>Live crane location. Operator starts only with your 4-digit OTP.</span>
          </li>
        </ol>
      </section>

      <h2 className="section-title">Our fleet</h2>
      <div className="grid">
        {(catalog?.classes ?? []).map((c) => (
          <article key={c.id} className="crane-card">
            <header>
              <span className={`tag tag--${c.category}`}>{c.category === "hydra" ? "Hydra" : "Telescopic"}</span>
              <h3>{c.name}</h3>
            </header>
            <p>{c.description}</p>
            <dl>
              <div>
                <dt>Capacity</dt>
                <dd>{c.capacityTons} t</dd>
              </div>
              <div>
                <dt>Height</dt>
                <dd>{c.maxLiftHeightM} m</dd>
              </div>
              <div>
                <dt>Radius</dt>
                <dd>{c.maxRadiusM} m</dd>
              </div>
            </dl>
            <footer>
              <span>
                from <strong>{formatINR(c.rates.hourly)}</strong>/hr
              </span>
              <Link to={`/book?crane=${c.id}`} className="btn btn--small">
                Book
              </Link>
            </footer>
          </article>
        ))}
      </div>

      <section className="trust">
        <div>✅ Experienced, certified operators</div>
        <div>✅ Short-term, daily & monthly rentals</div>
        <div>✅ GST invoices for contractors</div>
        <div>✅ UPI, cash or bank transfer</div>
      </section>

      <footer className="site-footer">
        <p>
          {catalog?.business.name ?? "Sri Venkateswara Crane Service"} · {catalog?.business.address ?? "Tamil Nadu"} ·{" "}
          <a href={`tel:+91${phone}`}>+91 {phone.slice(0, 5)} {phone.slice(5)}</a>
        </p>
        <p>
          <a href="https://youtube.com/@sri_venkateswara_crane_salem" target="_blank" rel="noreferrer">
            YouTube
          </a>{" "}
          ·{" "}
          <a href="https://g.co/kgs/uMLVs3h" target="_blank" rel="noreferrer">
            Google profile
          </a>
        </p>
      </footer>
    </div>
  );
}
