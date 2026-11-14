import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="state-page">
      <div className="state-card card">
        <div className="state-card__icon">
          <Compass size={26} />
        </div>
        <h1>Halaman tidak ditemukan</h1>
        <p>
          Alamat yang kamu buka tidak tersedia di WPC. Periksa kembali menu atau kembali ke
          dashboard untuk melanjutkan pekerjaan.
        </p>
        <Link to="/">
          <Button variant="primary">Kembali ke Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
